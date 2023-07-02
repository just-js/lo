const { system } = spin.load('system')

// todo: what happens if these wrappers are called more than once?

system.constants = {
  _SC_CLK_TCK: 2,
  EAGAIN: 11,
  EINPROGRESS: 115,
  MAX_PATH: 4096,
  CLOCK_REALTIME: 0,
  CLOCK_MONOTONIC: 1,
  TFD_NONBLOCK: 2048,
  TFD_CLOEXEC: 524288,
  PIDFD_NONBLOCK: 2048,
  SYS_gettid: 186,
  SYS_pidfd_open: 434,
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

function wrapRLimit () {
  const { RLIMIT_NOFILE } = system.constants
  const rlim = new Uint32Array(4)
  const _getrlimit = system.getrlimit
  const _setrlimit = system.setrlimit

  system.getrlimit = (resource = RLIMIT_NOFILE) => {
    const rc = _getrlimit(resource, rlim)
    if (rc !== 0) return
    return [rlim[0], rlim[2]]
  }

  system.setrlimit = (soft = 0, hard = 0, resource = RLIMIT_NOFILE) => {
    rlim[0] = soft
    rlim[2] = hard
    return _setrlimit(resource, rlim)
  }
}

function wrapCpuTime () {
  const cpubuf = new Uint8Array(20)
  const cpu32 = new Uint32Array(cpubuf.buffer)

  system.cputime = () => {
    cpu32[4] = system.times(cpubuf)
    return cpu32
  }
}

function wrapSysInfo () {
  const _sysinfo = system.sysinfo
  const sysinfo_buf = new Uint8Array(128)
  const sysinfo_u64 = new BigUint64Array(sysinfo_buf.buffer)
  const sysinfo_u32 = new Uint32Array(sysinfo_buf.buffer)
  const sysinfo_u16 = new Uint16Array(sysinfo_buf.buffer)

  system.uptime = () => {
    _sysinfo(sysinfo_buf)
    return sysinfo_u32[0]
  }

  system.sysinfo = () => {
    _sysinfo(sysinfo_buf)
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
}

function wrapStrError () {
  const eb = new Uint8Array(1024)
  const { strerror_r } = system
  system.strerror = (errnum = spin.errno) => {
    const rc = strerror_r(errnum, eb, 1024)
    if (rc !== 0) return
    return decoder.decode(eb)
  }
}

function wrapRusage () {
  const rusage = new Uint8Array(148)
  const u32 = new Uint32Array(rusage.buffer)
  const stats = u32.subarray(8)
  const { getrusage } = system

  system.getrusage = (flags = system.constants.RUSAGE_SELF) => {
    getrusage(flags, rusage)
    return stats
  }
}

function wrapCPUTime () {
  const cpu32 = new Uint32Array(5)
  const u8 = new Uint8Array(cpu32.buffer)  

  system.cputime = () => {
    cpu32[4] = system.times(u8)
    return cpu32
  }
}

function wrapGetEnv () {
  const _getenv = spin.wrap(new Uint32Array(2), system.getenv, 1)

  system.getenv = str => {
    const ptr = _getenv(str)
    if (!ptr) return
    return spin.utf8Decode(ptr, -1)
  }
}

function wrapGetCwd () {
  const _getcwd = spin.wrap(new Uint32Array(2), system.getcwd, 2)
  const cwdbuf = new Uint8Array(1024)

  system.getcwd = () => {
    const ptr = _getcwd(cwdbuf, cwdbuf.length)
    if (!ptr) return
    return spin.utf8Decode(ptr, -1)
  }
}

function wrapReadLink () {
  const _readlink = system.readlink
  const cwdbuf = spin.ptr(new Uint8Array(1024))

  system.readlink = linkPath => {
    const len = _readlink(linkPath, cwdbuf, cwdbuf.length)
    if (!len) return
    return spin.utf8Decode(cwdbuf.ptr, len)
  }
}

function wrapGetTid () {
  const { SYS_gettid } = system.constants
  const _gettid = system.gettid

  system.gettid = () => _gettid(SYS_gettid)
}

function wrapPidFdOpen () {
  const { SYS_pidfd_open } = system.constants
  const _pidfd_open = system.pidfd_open
  const { PIDFD_NONBLOCK } = system.constants

  system.pidfd_open = (pid, flags = PIDFD_NONBLOCK) => {
    return _pidfd_open(SYS_pidfd_open, pid, flags)
  }
}

const decoder = new TextDecoder()

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
system.calloc = spin.wrap(new Uint32Array(2), system.calloc, 2)
system.signal = spin.wrap(new Uint32Array(2), system.signal, 2)
system.mmap = spin.wrap(new Uint32Array(2), system.mmap, 6)

wrapStrError()
wrapRusage()
wrapCPUTime()
wrapGetEnv()
wrapGetTid()
wrapPidFdOpen()
wrapRLimit()
wrapCpuTime()
wrapSysInfo()
wrapGetCwd()
wrapReadLink()

export { system }
