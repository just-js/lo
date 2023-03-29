const { system } = spin.load('system')
const { load } = spin.load('load')

system.constants = {
  _SC_CLK_TCK: 2,
  EAGAIN: 11,
  EINPROGRESS: 115,
  MAX_PATH: 4096,
  CLOCK_REALTIME: 0,
  CLOCK_MONOTONIC: 1,
  TFD_NONBLOCK: 2048,
  TFD_CLOEXEC: 524288,
  RUSAGE_SELF: 0,
  RUSAGE_THREAD: 1,
  /* Per-process CPU limit, in seconds.  */
  RLIMIT_CPU: 0,
  /* Largest file that can be created, in bytes.  */
  RLIMIT_FSIZE: 1,
  /* Maximum size of data segment, in bytes.  */
  RLIMIT_DATA: 2,
  /* Maximum size of stack segment, in bytes.  */
  RLIMIT_STACK: 3,
  /* Largest core file that can be created, in bytes.  */
  RLIMIT_CORE: 4,
  /* Largest resident set size, in bytes.
     This affects swapping; processes that are exceeding their
     resident set size will be more likely to have physical memory
     taken from them.  */
  RLIMIT_RSS: 5,
  /* Number of open files.  */
  RLIMIT_NOFILE: 7,
  /* Address space limit.  */
  RLIMIT_AS: 9,
  /* Number of processes.  */
  RLIMIT_NPROC: 6,
  /* Locked-in-memory address space.  */
  RLIMIT_MEMLOCK: 8,
  /* Maximum number of file locks.  */
  RLIMIT_LOCKS: 10,
  /* Maximum number of pending signals.  */
  RLIMIT_SIGPENDING: 11,
  /* Maximum bytes in POSIX message queues.  */
  RLIMIT_MSGQUEUE: 12,
  /* Maximum nice priority allowed to raise to.
     Nice levels 19 .. -20 correspond to 0 .. 39
     values of this resource limit.  */
  RLIMIT_NICE: 13,
  /* Maximum realtime priority allowed for non-priviledged
     processes.  */
  RLIMIT_RTPRIO: 14,
  /* Maximum CPU time in µs that a process scheduled under a real-time
     scheduling policy may consume without making a blocking system
     call before being forcibly descheduled.  */
  RLIMIT_RTTIME: 15,
  RLIMIT_NLIMITS: 16
}

const nullstring = '\0'
const NULL = new Uint8Array(1)
system.NULL = NULL
system.nullstring = nullstring

const pu32 = new Uint32Array(2)

function fromPtr () {
  return pu32[0] + ((2 ** 32) * pu32[1])  
}

system.dlopen = (path = '') => {
  load.dlopen(spin.CString(path).ptr, 1, pu32)
  return fromPtr()
}

system.dlsym = (handle, sym = '') => {
  load.dlsym(handle, spin.CString(sym).ptr, pu32)
  return fromPtr()
}

const _calloc = system.calloc
system.calloc = (num, size) => {
  _calloc(num, size, u32)
  return fromPtr()
}

const _signal = system.signal
system.signal = (sig, action) => {
  _signal(sig, action, u32)
  return fromPtr()
}

/*
const handle = system.dlopen()
const errnoPtr = system.dlsym(handle, 'errno')
const errnob = new Uint32Array(spin.readMemory(BigInt(errnoPtr), 
  BigInt(errnoPtr) + 4n))

// TODO: setting this (system.errno = 0) causes GC - why??
Object.defineProperty(system, 'errno', {
  configurable: false,
  enumerable: true,
  get: () => errnob[0],
  set: num => errnob[0] = num
})
*/

Object.defineProperty(system, 'errno', {
  configurable: false,
  enumerable: true,
  get: () => spin.errno,
  set: num => spin.errno = num
})

const rbuf = new ArrayBuffer(148)
const u32 = new Uint32Array(rbuf)
const rptr = spin.getAddress(rbuf)
const stats = u32.subarray(8)
const _getrusage = system.getrusage
system.getrusage = (flags = system.constants.RUSAGE_SELF) => {
  _getrusage(flags, rptr)
  return stats
}

const rlim = new Uint32Array(4)
rlim.ptr = spin.getAddress(rlim.buffer)
const _getrlimit = system.getrlimit
system.getrlimit = (resource = RLIMIT_NOFILE) => {
  const rc = _getrlimit(resource, rlim.ptr)
  if (rc !== 0) return
  return [rlim[0], rlim[2]]
}
const _setrlimit = system.setrlimit
system.setrlimit = (resource = RLIMIT_NOFILE, soft = 0, hard = 0) => {
  rlim[0] = soft
  rlim[2] = hard
  return _setrlimit(resource, rlim.ptr)
}

const timers = {}
const timespec = new Uint8Array(16)
const t32 = new Uint32Array(timespec.buffer)
const tptr = spin.getAddress(timespec.buffer)
const { clock_gettime } = system
const { CLOCK_MONOTONIC, TFD_NONBLOCK, TFD_CLOEXEC } = system.constants
system.hrtime = () => {
  clock_gettime(CLOCK_MONOTONIC, tptr)
  return (t32[0] * 1e9) + t32[2]
}

system.timer = (repeat, timeout = repeat) => {
  const itimerspec = new Uint8Array(32)
  const timerPtr = spin.getAddress(itimerspec.buffer)
  const u64 = new BigUint64Array(itimerspec.buffer)
  u64[0] = BigInt(Math.floor(repeat / 1000))
	u64[1] = BigInt((repeat % 1000) * 1000000)
	u64[2] = BigInt(Math.floor(timeout / 1000))
	u64[3] = BigInt((timeout % 1000) * 1000000)
  const fd = system.timerfd_create(CLOCK_MONOTONIC, TFD_NONBLOCK | TFD_CLOEXEC)
  if (fd < 0) return fd
  const rc = system.timerfd_settime(fd, 0, timerPtr, 0);
  if (rc < 0) return rc
  timers[fd] = itimerspec
  return fd
}

const __NR_pidfd_open = 434
const PIDFD_NONBLOCK = 2048
const _pidfd_open = system.pidfd_open
system.pidfd_open = (pid, flags = PIDFD_NONBLOCK) => {
  return _pidfd_open(__NR_pidfd_open, pid, flags)
}

const errbuf = new spin.RawBuffer(1024)
system.strerror = (errnum = system.errno) => {
  const rc = system.strerror_r(errnum, errbuf.ptr, 1024)
  if (rc !== 0) return ''
  return spin.readLatin1(errbuf.id).trim()
}

const cpubuf = new spin.RawBuffer(20)
const cpu32 = new Uint32Array(cpubuf.buf)
system.cputime = () => {
  cpu32[4] = system.times(cpubuf.ptr)
  return cpu32
}

const _sysinfo = system.sysinfo
const sysinfo_buf = new spin.RawBuffer(128)
const sysinfo_u64 = new BigUint64Array(sysinfo_buf.buf)
const sysinfo_u32 = new Uint32Array(sysinfo_buf.buf)
const sysinfo_u16 = new Uint16Array(sysinfo_buf.buf)
system.uptime = () => {
  _sysinfo(sysinfo_buf.ptr)
  return sysinfo_u32[0]
}

system.sysinfo = () => {
  _sysinfo(sysinfo_buf.ptr)
  const [uptime, , load1, , load5, , load15 ] = sysinfo_u32
  const [
    , , , , totalram, freeram, sharedram, bufferram, totalswap, freeswap
  ] = sysinfo_u64
  const nproc = sysinfo_u16[40]
  return {
    uptime, load1, load5, load15, totalram, freeram, sharedram, bufferram, 
    totalswap, freeswap, nproc
  }
}

class SystemError extends Error {
  constructor (name) {
    const { errno, strerror } = system
    const message = `${name} (${errno}) ${strerror(errno)}`
    super(message)
    this.errno = errno
    this.name = 'SystemError'
  }
}

system.SystemError = SystemError

export { system }
