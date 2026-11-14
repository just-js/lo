import { Worker } from 'lib/worker.js'
import { system } from 'lib/system.js'

// a Cell is a Worker (an isolate on its own thread) that can be watched and
// controlled from another thread (linux only):
// - a pidfd for its thread (PIDFD_THREAD, linux 6.9+): readable when the
//   thread exits, so a supervisor can wait on many cells in one epoll set
// - cpu time (thread cpu clock), run-queue wait and timeslices
//   (/proc/self/task/<tid>/schedstat), sampled with sample()
// - heap stats, written by the isolate itself on request (request_stats())
// - a heap limit: near it the isolate is terminated instead of V8 aborting
//   the process (exit_reason HEAP_LIMIT)
// - terminate(): TerminateExecution from another thread (exit_reason
//   TERMINATED), renice(), and a scheduling policy applied at start
//
// what to do with all this (when to renice, terminate, restart) is up to the
// supervisor, see celld4.js

const { core, ptr, readMemory, hrtime, assert } = lo
const {
  close, open, pread, O_RDONLY, O_CLOEXEC, little_endian,
  isolate_terminate, isolate_request_stats, isolate_context_size
} = core
const { pthread } = lo.load('pthread')
const { PRIO_PROCESS } = system

// pthread_t is a pointer to libc's struct pthread. musl x86_64 (1.2):
// { self, dtv, prev, next, sysinfo, canary; int tid } -> tid at 48. musl
// clones with CLONE_PARENT_SETTID, so it's set before pthread_create returns.
// libc-private layout, hardcoded for now (todo: discover it at startup)
const PTHREAD_TID_OFFSET = 48
const SYS_pidfd_open = 434
const SYS_sched_setscheduler = 144 // x86_64
const PIDFD_THREAD = 0x80 // O_EXCL
const ESRCH = 3

// struct isolate_context (lo.h): the fields after void* isolate
const CONTEXT_SIZE = 168
const HEAP_LIMIT = 104
const HEAP_USED = 112
const HEAP_TOTAL = 120
const HEAP_MAX = 128
const HEAP_EXTERNAL = 136
const GC_COUNT = 144
const STATS_TIME = 152
const EXIT_REASON = 160
assert(isolate_context_size() === CONTEXT_SIZE,
  `isolate_context is ${isolate_context_size()} bytes, lib/cell.js expects ${CONTEXT_SIZE}`)

// LO_EXIT_* (lo.h)
const exit_reasons = ['normal', 'terminated', 'heap limit']

// V8 bug (15.6.75, Turboshaft LoopStackCheckElisionReducer): a loop with a
// static trip count < 5000 and no JS stack check of its own (e.g. the inlined
// fill in `while (true) new Array(1000).fill(1)`) leaves its "skip the next
// loop stack check" flag set, and the enclosing loop's back-edge stack check
// is dropped instead. that loop then never checks for interrupts, so
// TerminateExecution (terminate(), the heap limit) can't stop it. turning off
// loop unrolling disables the elision. process-wide, affects code compiled
// from now on (LO-ISOLATES.md "TerminateExecution and loop stack checks")
lo.setFlags('--no-turboshaft-loop-unrolling')

const tidbuf = ptr(new Int32Array(1))
const clockbuf = ptr(new Int32Array(1))
const timespec = ptr(new Uint32Array(4)) // tv_sec i64, tv_nsec i64
const statbuf = ptr(new Uint8Array(128))
const sched_param = ptr(new Int32Array(1)) // struct sched_param { int priority }
const cpu_set = ptr(new Uint8Array(core.struct_cpu_set_t_size || 128))
const decoder = new TextDecoder()

function kernel_tid (pthread_t) {
  readMemory(tidbuf.ptr, pthread_t + PTHREAD_TID_OFFSET, 4)
  return tidbuf[0]
}

function cpu_clock (pthread_t) {
  if (pthread.getcpuclockid(pthread_t, clockbuf.ptr) !== 0) return 0
  return clockbuf[0]
}

// cpu time in ns on a cpu clock (a thread's, or CLOCK_PROCESS_CPUTIME_ID)
function cpu_ns (clockid) {
  if (system.clock_gettime(clockid, timespec.ptr) !== 0) return -1
  return timespec[0] * 1e9 + timespec[2]
}

// schedstat: "<cpu ns> <run queue wait ns> <timeslices>\n"
function schedstat (fd) {
  const n = pread(fd, statbuf.ptr, statbuf.length, 0)
  if (n <= 0) return null
  const [, wait, slices] = decoder.decode(statbuf.subarray(0, n)).split(' ')
  return { wait: Number(wait), slices: parseInt(slices, 10) }
}

// pin any thread (by pthread_t) to a list of cpus
function set_affinity (pthread_t, cpus) {
  cpu_set.fill(0)
  for (const cpu of cpus) cpu_set[cpu >> 3] |= 1 << (cpu & 7)
  return pthread.setAffinity(pthread_t, cpu_set.length, cpu_set.ptr)
}

class Cell extends Worker {
  // options: heap_limit (max old generation bytes, 0 = V8 default),
  // policy (SCHED_* applied to the thread at start, -1 = inherit)
  constructor (script, args, runtime, { heap_limit = 0, policy = -1 } = {}) {
    super(script, args, runtime)
    this.heap_limit = heap_limit
    this.policy = policy
    this.thread_id = 0  // kernel tid (this.tid is the pthread_t)
    this.pidfd = -1
    this.clock = 0
    this.stat = -1
    // last sample(): load = cpu / wall, demand = (cpu + run-queue wait) / wall
    this.load = 0
    this.demand = 0
    this.dwait = 0
    this.dslices = 0
    this.cpu = 0
    this.wait = 0
    this.slices = 0
    this.wall = 0
  }

  #set_u64 (off, n) {
    this.view.setUint32(off, n % 0x100000000, little_endian)
    this.view.setUint32(off + 4, Math.floor(n / 0x100000000), little_endian)
  }

  #u64 (off) {
    return this.view.getUint32(off, little_endian) +
      this.view.getUint32(off + 4, little_endian) * 0x100000000
  }

  // starts the thread and opens its pidfd. pidfd is -1 if the thread already
  // exited before we could open it: join it with waitfor()
  start (cpus) {
    this.#set_u64(HEAP_LIMIT, this.heap_limit)
    super.start(cpus)
    const tid = this.thread_id = kernel_tid(this.tid)
    this.pidfd = system.pidfd_open(SYS_pidfd_open, tid, PIDFD_THREAD)
    if (this.pidfd < 0) {
      if (lo.errno !== ESRCH) throw new Error(`pidfd_open: ${system.strerror()}`)
      return this
    }
    if (this.policy >= 0) {
      sched_param[0] = 0
      system.sched_setscheduler(SYS_sched_setscheduler, tid, this.policy,
        sched_param.ptr)
    }
    this.clock = cpu_clock(this.tid)
    this.stat = open(`/proc/self/task/${tid}/schedstat`, O_RDONLY | O_CLOEXEC, 0)
    // baseline now, not 0: the thread may already have run for a while if
    // we were descheduled after pthread_create
    const s = this.stat >= 0 ? schedstat(this.stat) : null
    this.cpu = Math.max(cpu_ns(this.clock), 0)
    this.wall = hrtime()
    this.wait = s ? s.wait : 0
    this.slices = s ? s.slices : 0
    this.load = this.demand = this.dwait = this.dslices = 0
    return this
  }

  // update load/demand/dwait/dslices since the last sample (or start).
  // false if the thread has exited (its pidfd event is on its way)
  sample () {
    // wall time next to the cpu read: sampling many cells can take 100s of
    // ms when the cpus are saturated (the caller is on the run queue too)
    const now = hrtime()
    const cpu = cpu_ns(this.clock)
    if (cpu < 0) return false
    const s = this.stat >= 0 ? schedstat(this.stat) : null
    const dt = now - this.wall
    const dcpu = cpu - this.cpu
    this.dwait = 0
    this.dslices = 0
    if (s) {
      this.dwait = s.wait - this.wait
      this.dslices = s.slices - this.slices
      this.wait = s.wait
      this.slices = s.slices
    }
    this.load = dcpu / dt
    this.demand = (dcpu + this.dwait) / dt
    this.cpu = cpu
    this.wall = now
    return true
  }

  // ask the isolate to write its heap stats into the context; they show up
  // in heap once it next checks for interrupts (not while blocked in a
  // syscall). 0 = requested, -1 = no live isolate
  request_stats () {
    return isolate_request_stats(this.context.ptr)
  }

  // the last stats the isolate wrote (time 0 = none yet this run)
  get heap () {
    return {
      used: this.#u64(HEAP_USED),
      total: this.#u64(HEAP_TOTAL),
      max: this.#u64(HEAP_MAX),
      external: this.#u64(HEAP_EXTERNAL),
      gcs: this.#u64(GC_COUNT),
      time: this.#u64(STATS_TIME)
    }
  }

  // why the isolate stopped: 'normal', 'terminated' or 'heap limit'
  get exit_reason () {
    return exit_reasons[this.view.getInt32(EXIT_REASON, little_endian)]
  }

  // TerminateExecution from this thread. 0 = sent, -1 = no live isolate
  terminate () {
    return isolate_terminate(this.context.ptr)
  }

  renice (nice) {
    return system.setpriority(PRIO_PROCESS, this.thread_id, nice)
  }

  // after the thread has exited: close the pidfd and schedstat fds
  close () {
    if (this.pidfd >= 0) close(this.pidfd)
    if (this.stat >= 0) close(this.stat)
    this.pidfd = this.stat = -1
    return this
  }
}

const CLOCK_PROCESS_CPUTIME_ID = 2

// cpu time of the whole process in ns
function process_cpu_ns () {
  return cpu_ns(CLOCK_PROCESS_CPUTIME_ID)
}

export { Cell, set_affinity, process_cpu_ns }
