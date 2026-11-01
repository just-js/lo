import { spawn, join, pthread } from 'lib/thread.js'

const { core, utf8Length, assert, cstr, ptr, addr, isolate_start_address } = lo
const { little_endian } = core
const {
  isolate_context_create, isolate_context_size, isolate_context_destroy
} = core

const { EBUSY, tryJoin } = pthread

// TODO: this is nasty - clean it up
function makeArgs (args) {
  const argb = new Array(args.length)
  if (!args.length) return { args: new Uint8Array(0) }
  const b64 = new BigUint64Array(args.length + 1)
  for (let i = 0; i < args.length; i++) {
    const str = argb[i] = cstr(args[i])
    // @ts-ignore
    b64[i] = BigInt(str.ptr)
  }
  return {
    args: ptr(new Uint8Array(b64.buffer)),
    cstrings: argb
  }
}

class Worker {
  script_path = 'main.js'
  #initialized = false

  constructor (script, args = [], runtime = lo.builtin('main.js')) {
    this.script = script
    this.context = ptr(lo.wrap_memory(lo.core.calloc(1, isolate_context_size()), isolate_context_size(), 0))
//    this.context = ptr(new Uint8Array(isolate_context_size()))
    this.view = new DataView(this.context.buffer)
    this.argv = makeArgs(args)
    this.argc = args.length
    this.runtime = runtime
    this.tid = 0
    this.exit_code = 0
    this.cleanup = 1
    this.onexit = 0
    this.snapshot = 0
    this.rc = 0
    // the isolate's thread stack: V8 assumes ~1 MB (--stack-size), musl's
    // default thread stack is 128 KiB, so deep recursion would overrun it
    this.stack_size = 4 * 1024 * 1024
  }

  create (fd = 0, buf, buflen = buf ? buf.length: 0) {
    const { argc, argv, context, runtime, script, script_path, cleanup, onexit, snapshot } = this
    if (buf && buf.buffer) {
      // todo: keep track of this buffer
      if (!buf.ptr) buf = ptr(buf)
      isolate_context_create(argc, argv.args.ptr, runtime, utf8Length(runtime), script, 
        utf8Length(script), buf ? buf.ptr : 0, buf ? buf.length : 0, fd, lo.hrtime(), 'lo', 
        script_path, cleanup, onexit, snapshot, context.ptr)
    } else {
      // todo: keep track of this pointer
      isolate_context_create(argc, argv.args.ptr, runtime, utf8Length(runtime), script, 
        utf8Length(script), buf || 0, buflen || 0, fd, lo.hrtime(), 'lo', 
        script_path, cleanup, onexit, snapshot, context.ptr)
    }
    this.#initialized = true
    return this
  }

  // cpus: optional array of cpu numbers to pin the worker's thread to
  start (cpus) {
    if (!this.#initialized) return
    this.tid = spawn(start_isolate_address, this.context.ptr, this.stack_size)
    if (cpus) this.affinity = cpus
    return this
  }

  // the cpus the worker's thread may run on (linux), as an array of cpu numbers
  set affinity (cpus) {
    cpu_set.fill(0)
    for (const cpu of cpus) cpu_set[cpu >> 3] |= 1 << (cpu & 7)
    assert(pthread.setAffinity(this.tid, cpu_set.length, cpu_set.ptr) === 0)
  }

  get affinity () {
    assert(pthread.getAffinity(this.tid, cpu_set.length, cpu_set.ptr) === 0)
    const cpus = []
    for (let cpu = 0; cpu < cpu_set.length * 8; cpu++) {
      if (cpu_set[cpu >> 3] & (1 << (cpu & 7))) cpus.push(cpu)
    }
    return cpus
  }

  waitfor () {
    if (!this.tid || !this.#initialized) return -1
    this.rc = join(this.tid)
    // struct isolate_context: uint64_t start, then int rc (lo.h)
    this.exit_code = this.view.getInt32(8, little_endian)
    return this
  }

  poll () {
    if (!this.tid || !this.#initialized) return true
    if (tryJoin(this.tid, rcbuf.ptr) === EBUSY) return true
    return false
  }

  free () {
    isolate_context_destroy(this.context.ptr)
    this.#initialized = false
    lo.unwrap_memory(this.context.buffer)
    lo.core.free(this.context.ptr)
    return this
  }

  stop () {
    pthread.cancel(this.tid)
    return this
  }

  kill (signum) {
    pthread.kill(this.tid, signum)
    return this
  }
}

const rcbuf = ptr(new Uint32Array(2))
const start_isolate_address = isolate_start_address()
// cpu_set_t for pthread_setaffinity_np (128 bytes on linux)
const cpu_set = ptr(new Uint8Array(core.struct_cpu_set_t_size || 128))

export { Worker }
