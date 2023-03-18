const api = {
  getcwd: {
    parameters: ['pointer', 'i32'],
    pointers: ['char*'],
    result: 'pointer',
    rpointer: ['char*']
  },
  clock_gettime: {
    parameters: ['i32', 'pointer'],
    pointers: [, 'timespec*'],
    result: 'i32'
  },
  exit: {
    parameters: ['i32'],
    result: 'void',
    nofast: true
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
    parameters: ['i32', 'pointer'],
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
    parameters: ['i32', 'i32', 'pointer', 'pointer'],
    pointers: [, , 'const struct itimerspec*', 'struct itimerspec*'],
    result: 'i32'
  },
  fork: {
    parameters: [],
    result: 'i32'
  },
  waitpid: {
    parameters: ['i32', 'pointer', 'i32'],
    pointers: [, 'int*'],
    result: 'i32'
  },
  execvp: {
    parameters: ['pointer', 'pointer'],
    pointers: ['char*', 'char* const*'],
    result: 'i32'
  },
  sysconf: {
    parameters: ['i32'],
    result: 'u32'
  },
  syscall: {
    parameters: ['i32', 'i32', 'u32'],
    result: 'i32',
    name: 'pidfd_open'
  },
  getrlimit: {
    parameters: ['i32', 'pointer'],
    pointers: [, 'struct rlimit*'],
    result: 'i32'
  },
  setrlimit: {
    parameters: ['i32', 'pointer'],
    pointers: [, 'const struct rlimit*'],
    result: 'i32'
  },
  strerror_r: {
    parameters: ['i32', 'pointer', 'u32'],
    pointers: [, 'char*'],
    result: 'i32'
  },
  times: {
    parameters: ['pointer'],
    pointers: ['struct tms*'],
    result: 'i32'
  },
  sysconf: {
    parameters: ['i32'],
    pointers: [],
    result: 'u32'
  },
  sysinfo: {
    parameters: ['pointer'],
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
    parameters: ['pointer'],
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
  }
}

const includes = ['sys/times.h', 'sys/resource.h', 'unistd.h', 'sys/timerfd.h', 'sys/wait.h', 'sys/sysinfo.h', 'signal.h']
const name = 'system'
const libs = []
const obj = ['system.a']

export { api, includes, name, libs, obj }
