const api = {
  mmap: {
    parameters: ['pointer', 'u32', 'i32', 'i32', 'i32', 'u32'],
    result: 'pointer'
  },
  munmap: {
    parameters: ['pointer', 'u32'],
    result: 'i32'
  },
  getcwd: {
    parameters: ['buffer', 'i32'],
    pointers: ['char*'],
    result: 'pointer',
    rpointer: ['char*']
  },
  eventfd: {
    parameters: ['u32', 'i32'],
    result: 'i32'
  },
  clock_gettime: {
    parameters: ['i32', 'pointer'],
    pointers: [, 'timespec*'],
    result: 'i32'
  },
  mprotect: {
    parameters: ['pointer', 'u32', 'i32'],
    result: 'i32'
  },
  memcpy: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  memmove: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  exit: {
    parameters: ['i32'],
    result: 'void'
  },
  usleep: {
    parameters: ['u32'],
    result: 'i32'
  },
  getpid: {
    parameters: [],
    result: 'i32'
  },
  getrusage: {
    parameters: ['i32', 'buffer'],
    pointers: [, 'struct rusage*'],
    result: 'i32'
  },
  timerfd_create: {
    parameters: ['i32', 'i32'],
    result: 'i32'
  },
  sleep: {
    parameters: ['u32'],
    result: 'u32'
  },
  timerfd_settime: {
    parameters: ['i32', 'i32', 'buffer', 'pointer'],
    pointers: [, , 'const struct itimerspec*', 'struct itimerspec*'],
    result: 'i32'
  },
  fork: {
    parameters: [],
    result: 'i32'
  },
  kill: {
    parameters: ['i32', 'i32'],
    result: 'i32'
  },
  waitpid: {
    parameters: ['i32', 'buffer', 'i32'],
    pointers: [, 'int*'],
    result: 'i32'
  },
  execvp: {
    parameters: ['string', 'buffer'],
    pointers: ['const char*', 'char* const*'],
    result: 'i32'
  },
  readlink: {
    parameters: ['string', 'buffer', 'u32'],
    pointers: ['const char*', 'char*'],
    result: 'u32'
  },
  sysconf: {
    parameters: ['i32'],
    result: 'u32'
  },
  // TODO: allow hardcoding a value as params here
  pidfd_open: {
    parameters: ['i32', 'i32', 'u32'],
    values: [],
    result: 'i32',
    name: 'syscall'
  },
  gettid: {
    parameters: ['i32'],
    result: 'i32',
    name: 'syscall'
  },
  getrlimit: {
    parameters: ['i32', 'u32array'],
    pointers: [, 'struct rlimit*'],
    result: 'i32'
  },
  setrlimit: {
    parameters: ['i32', 'u32array'],
    pointers: [, 'const struct rlimit*'],
    result: 'i32'
  },
  strerror_r: {
    parameters: ['i32', 'buffer', 'u32'],
    pointers: [, 'char*'],
    result: 'i32'
  },
  times: {
    parameters: ['buffer'],
    pointers: ['struct tms*'],
    result: 'i32'
  },
  sysinfo: {
    parameters: ['buffer'],
    pointers: ['struct sysinfo*'],
    result: 'u32'
  },
  get_avphys_pages: {
    parameters: [],
    pointers: [],
    result: 'u32'
  },
  signal: {
    parameters: ['i32', 'pointer'],
    pointers: [, 'sighandler_t'],
    rpointer: 'sighandler_t',
    result: 'pointer'
  },
  getenv: {
    parameters: ['string'],
    pointers: ['const char*'],
    rpointer: 'char*',
    result: 'pointer'
  },
  calloc: {
    parameters: ['u32', 'u32'],
    result: 'pointer'
  },
  free: {
    parameters: ['pointer'],
    result: 'void'
  },
  memfd_create: {
    parameters: ['string', 'u32'],
    result: 'i32'
  }
}

const constants = {
  _SC_CLK_TCK: 'u32',
  UFFD_API: 'u64',
  _UFFDIO_API: 'u32'
}

const includes = [
  'sys/eventfd.h', 'sys/times.h', 'sys/resource.h', 'unistd.h', 'sys/timerfd.h',
  'sys/wait.h', 'sys/sysinfo.h', 'signal.h', 'sys/mman.h', 'linux/userfaultfd.h'
]
const name = 'system'
const libs = []
const obj = []

export { api, includes, name, libs, obj, constants }
