const api = {
// dynamic loader
// this is just an example of a jsdoc. should we embed jsdoc here or generate it?
// we should generate wrappers in JS with the JSdoc in them
  dlopen: {
    parameters: ['string', 'i32'],
    pointers: ['const char*'],
    jsdoc: `/**
* The  function  dlopen()  loads  the  dynamic shared object (shared library)
* file named by the null-terminated string filename and returns an opaque
* "handle" for the loaded object.  This handle is employed with other
* functions in the dlopen API, such as dlsym(3), dladdr(3), dlinfo(3),
* and dlclose()
*
* \`\`\`js
* const handle = assert(core.dlopen('libcurl.so', core.RTLD_NOW));
* \`\`\`
* @param file_path {string} the path to the shared library file to open.
* @param flags {number} (i32) resolve symbols now (RTLD_NOW) or lazily (RTLD_LAZY)
*/`,
    result: 'pointer',
    man: [
      'https://man7.org/linux/man-pages/man3/dlopen.3.html',
      'https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/dlopen.3.html'
    ]
  },
  dlsym: {
    parameters: ['pointer', 'string'],
    pointers: ['void*', 'const char*'],
    result: 'pointer'
  },
  dlclose: {
    parameters: ['pointer'],
    pointers: ['void*'],
    result: 'i32'
  },
  dlerror: {
    parameters: [],
    rpointer: 'char*',
    result: 'pointer'
  },
// file descriptor operations
  read: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  read2: {
    parameters: ['i32', 'pointer', 'i32'],
    result: 'i32',
    name: 'read'
  },
  write: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  write2: {
    parameters: ['i32', 'pointer', 'i32'],
    result: 'i32',
    name: 'write'
  },
  write_string: {
    parameters: ['i32', 'string', 'i32'],
    pointers: [, 'const char*'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }],
    result: 'i32',
    name: 'write'
  },
  putchar: {
    parameters: ['i32'],
    result: 'i32'
  },
  getchar: {
    parameters: [],
    result: 'i32'
  },
  close: {
    parameters: ['i32'],
    result: 'i32'
  },
  pread: {
    parameters: ['i32', 'buffer', 'i32', 'u32'],
    result: 'i32'
  },
  lseek: {
    parameters: ['i32', 'u32', 'i32'],
    result: 'u32'
  },
  fstat: {
    parameters: ['i32', 'buffer'],
    pointers: [, 'struct stat *'],
    result: 'i32'
  },
  fcntl: {
    parameters: ['i32', 'i32', 'i32'],
    result: 'i32'
  },
  ftruncate: {
    parameters: ['i32', 'u32'],
    result: 'i32'
  },
// file system operations
  mknod: {
    parameters: ['string', 'i32', 'i32'],
    result: 'i32'
  },
  stat: {
    parameters: ['string', 'buffer'],
    pointers: [, 'struct stat *'],
    result: 'i32'
  },
  lstat: {
    parameters: ['string', 'buffer'],
    pointers: [, 'struct stat *'],
    result: 'i32'
  },
  rename: {
    parameters: ['string', 'string'],
    result: 'i32'
  },
  access: {
    parameters: ['string', 'i32'],
    result: 'i32'
  },
  open: {
    parameters: ['string', 'i32', 'i32'],
    pointers: ['const char*'],
    result: 'i32'
  },
  unlink: {
    parameters: ['string'],
    result: 'i32'
  },
/*
  openat: {
    parameters: ['i32', 'string', 'i32'],
    result: 'i32',
  },
*/
  readdir: {
    parameters: ['pointer'],
    result: 'pointer',
    pointers: ['DIR*'],
    rpointer: 'dirent*'
  },
  readlink: {
    parameters: ['string', 'buffer', 'u32'],
    pointers: ['const char*', 'char*'],
    result: 'u32'
  },
  opendir: {
    parameters: ['string'],
    result: 'pointer',
    pointers: ['const char*'],
    rpointer: 'DIR*'
  },
  fstatat: {
    parameters: ['i32', 'string', 'buffer', 'i32'],
    pointers: [, , 'struct stat *'],
    result: 'i32'
  },
  mkdir: {
    parameters: ['string', 'u32'],
    result: 'i32',
  },
  rmdir: {
    parameters: ['string'],
    result: 'i32',
  },
  closedir: {
    parameters: ['pointer'],
    pointers: ['DIR*'],
    result: 'i32'
  },
  chdir: {
    parameters: ['string'],
    result: 'i32',
  },
  fchdir: {
    parameters: ['i32'],
    result: 'i32',
  },
// memory operations
  mprotect: {
    parameters: ['pointer', 'u32', 'i32'],
    result: 'i32'
  },
  memcpy: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  memset: {
    parameters: ['pointer', 'i32', 'u32'],
    result: 'pointer'
  },
  memmove: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  shm_open : {
    parameters: ['string', 'i32', 'i32'],
    result: 'i32'
  },
  shm_unlink : {
    parameters: ['string'],
    result: 'i32'
  },
  mmap: {
    parameters: ['pointer', 'u32', 'i32', 'i32', 'i32', 'u32'],
    result: 'pointer'
  },
  munmap: {
    parameters: ['pointer', 'u32'],
    result: 'i32'
  },
  msync: {
    parameters: ['pointer', 'u32', 'i32'],
    result: 'i32'
  },
  malloc: {
    parameters: ['u32'],
    result: 'pointer'
  },
  calloc: {
    parameters: ['u32', 'u32'],
    result: 'pointer'
  },
  realloc: {
    parameters: ['pointer', 'u32'],
    result: 'pointer'
  },
  aligned_alloc: {
    parameters: ['u32', 'u32'],
    result: 'pointer'
  },
  free: {
    parameters: ['pointer'],
    result: 'void'
  },
// fastcalls
  bind_fastcall: {
    declare_only: true,
    nofast: true
  },
  bind_slowcall: {
    declare_only: true,
    nofast: true
  },
  fastcall: {
    parameters: ['pointer'],
    pointers: ['struct fastcall*'],
    result: 'void',
    name: 'lo_fastcall',
    // lo_fastcall is declared in lo.h, not lo_abi.h -- bindingsAbi()'s
    // generated files deliberately never #include <lo.h> (that's what
    // keeps them from pulling in v8:: transitively), so this symbol has
    // no visibility there at all. Genuinely engine-internal regardless
    // (only meaningful alongside bind_fastcall/bind_slowcall, both
    // already declare_only/excluded) -- not a fixable gap the way
    // override/u32array were, see doc/WORK.md's E.9.
    no_abi: true
  },
// system
  getenv: {
    parameters: ['string'],
    pointers: ['const char*'],
    rpointer: 'char*',
    result: 'pointer'
  },
  setenv: {
    parameters: ['string', 'string', 'i32'],
    pointers: ['const char*', 'const char*'],
    result: 'i32'
  },
  unsetenv: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32'
  },
  sleep: {
    parameters: ['i32'],
    result: 'void'
  },
  usleep: {
    parameters: ['u32'],
    result: 'i32'
  },
  dup: {
    parameters: ['i32'],
    result: 'i32'
  },
  dup2: {
    parameters: ['i32', 'i32'],
    result: 'i32'
  },
  getcwd: {
    parameters: ['pointer', 'i32'],
    pointers: ['char*'],
    result: 'pointer'
  },
  getpid: {
    parameters: [],
    result: 'i32'
  },
  getsid: {
    parameters: ['i32'],
    result: 'i32'
  },
  setsid: {
    parameters: [],
    result: 'i32'
  },
  getpgrp: {
    parameters: [],
    result: 'i32'
  },
  setpgid: {
    parameters: ['i32', 'i32'],
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
    result: 'i32',
  },
  execve: {
    parameters: ['string', 'buffer', 'buffer'],
    pointers: ['const char*', 'char* const*', 'char* const*'],
    result: 'i32',
  },
  isatty: {
    parameters: ['i32'],
    result: 'i32'
  },
  tcgetattr: {
    parameters: ['i32', 'buffer'],
    pointers: [, 'struct termios *'],
    result: 'i32'
  },
  tcsetattr: {
    parameters: ['i32', 'i32', 'buffer'],
    pointers: [, , 'struct termios *'],
    result: 'i32'
  },
  exit: {
    parameters: ['i32'],
    result: 'void'
  },
  _exit: {
    parameters: ['i32'],
    result: 'void'
  },
  sysconf: {
    parameters: ['i32'],
    result: 'u32'
  },
// rusage
  getrusage: {
    parameters: ['i32', 'buffer'],
    pointers: [, 'struct rusage*'],
    result: 'i32'
  },
  times: {
    parameters: ['buffer'],
    pointers: ['struct tms*'],
    result: 'u32'
  },
// isolates
  isolate_create: {
    parameters: [
      'i32', 'u32array', 'string', 'u32', 'string', 'u32', 'buffer',
      'i32', 'i32', 'u64', 'string', 'string', 'i32', 'i32', 'pointer'
    ],
    pointers: [
      , 'char**', 'const char*', , 'const char*', , 'char*', , ,
      'const char*', 'const char*'
    ],
    result: 'i32',
    name: 'lo_create_isolate',
    jsdoc: ``,
    nofast: true,
    // Embedder-internal (creates a real V8 isolate) -- lo_create_isolate
    // is declared in lo.h, not visible to bindingsAbi()'s generated
    // files (same reason as `fastcall` above). Genuinely not portable,
    // not just unimplemented.
    no_abi: true
  },
  isolate_context_create: {
    parameters: [
      'i32', 'pointer', 'string', 'u32', 'string', 'u32', 'pointer',
      'i32', 'i32', 'u64', 'string', 'string', 'i32', 'i32', 'pointer', 'buffer'
    ],
    pointers: [
      , 'char**', 'const char*', , 'const char*', , 'char*', , ,
      'const char*', 'const char*', , , , , 'struct isolate_context*'
    ],
    result: 'void',
    name: 'lo_create_isolate_context',
    nofast: true,
    no_abi: true // see isolate_create's own comment
  },
  isolate_context_destroy: {
    parameters: ['buffer'],
    pointers: ['struct isolate_context*'],
    result: 'void',
    name: 'lo_destroy_isolate_context',
    no_abi: true // see isolate_create's own comment
  },
  isolate_context_size: {
    parameters: [],
    result: 'i32',
    name: 'lo_context_size',
    no_abi: true // see isolate_create's own comment
  },
  isolate_start: {
    parameters: ['buffer'],
    result: 'void',
    name: 'lo_start_isolate',
    nofast: true,
    no_abi: true // see isolate_create's own comment
  },
  callback: {
    parameters: ['pointer'],
    pointers: ['exec_info*'],
    result: 'void',
    name: 'lo_callback',
    nofast: true,
    no_abi: true // see isolate_create's own comment
  },
// strings
  memmem: {
    parameters: ['pointer', 'u32', 'pointer', 'u32'],
    result: 'pointer'
  },
  strnlen: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'u32'
  },
  symlink: {
    parameters: ['string', 'string'],
    pointers: ['const char*', 'const char*'],
    result: 'i32'
  },
  strnlen_str: {
    parameters: ['string', 'u32'],
    override: [, { param: 0, fastfield: '->length', slowfield: '.length()' }],
    pointers: ['const char*'],
    result: 'u32',
    name: 'strnlen'
  },
/*
  mmio_signal: {
    parameters: [],
    result: 'void'
  },
*/
  sync: {
    parameters: [],
    result: 'void'
  },
}

// optional preamble of C/C++ code to embed in the generated source file before
// compilation
//
// The generic dlopen'd-FFI-call machinery (struct fastcall, SlowCallback,
// bind_fastcallSlow/bind_slowcallSlow, CTypeFromV8, needsunwrap,
// lo_fastcall) used to be hand-written here directly -- moved to lo.h/
// lo_ffi.cc instead (real v8:: use, nothing core-specific about any of
// it, and lib/core2/api.js had its own near-verbatim copy for the
// Windows build, WORK.md's E.7 -- both resolved by sharing one real
// definition). lib/build.js's build_runtime only compiles+links
// lo_ffi.cc when a runtime config's bindings actually include 'core'/
// 'core2', so runtime/zero.config.js's deliberately core-less build
// still carries none of this weight -- see lo.h's own comment.
const preamble = `
#include <sys/types.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <unistd.h>
#include <string.h>

#ifdef __linux__

pid_t vexecve (const char* pathname, char* const argv[], char* const envp[]) {
  pid_t pid = vfork();
  if (pid == 0) {
    int rc = execve(pathname, argv, envp);
    exit(rc);
  }
  if (pid == -1) return pid;
  int status = 0;
  int rc = waitpid(pid, &status, 0);
  if (rc == -1) return rc;
  return status;
}

/*
we can use wait4 with rusage struct to get usage stats on waited process
https://github.com/ziglang/zig/blob/master/lib/std/process/Child.zig#L86
*/
pid_t vfexecve (int fd, char* const argv[], char* const envp[]) {
  pid_t pid = vfork();
  if (pid == 0) {
    int rc = fexecve(fd, argv, envp);
    exit(rc);
  }
  if (pid == -1) return pid;
  int status = 0;
  int rc = waitpid(pid, &status, 0);
  if (rc == -1) return rc;
  return status;
}

#endif
`

// constants that should be defined on the binding
// if we specify a number then that will be used. if a string, then
// it will be checked to see if it represents a variable type. if so, then
// that system constant will be set in the binding at compile time
// todo: we need to define platform for constants too
const constants = {
  S_IFBLK: 'i32', S_IFCHR: 'i32', S_IFIFO: 'i32',
  S_IRUSR: 'i32', S_IWUSR: 'i32', S_IRGRP: 'i32', S_IWGRP: 'i32',
  S_IROTH: 'i32', S_IWOTH: 'i32', O_RDONLY: 'i32', O_WRONLY: 'i32',
  O_CREAT: 'i32', S_IXOTH: 'i32', 
  S_IXUSR: 'i32', S_IXGRP: 'i32', S_IRWXU: 'i32', S_IRWXG: 'i32',
  O_TRUNC: 'i32', STDIN: 0, STDOUT: 1, STDERR: 2, O_CLOEXEC: 'i32', 
  RUSAGE_SELF: 'i32', SEEK_SET: 'i32', SEEK_CUR: 'i32',
  SEEK_END: 'i32', S_IRWXO: 'i32', F_OK: 'i32', S_IFMT: 'i32', S_IFDIR: 'i32',
  S_IFREG: 'i32', NAME_MAX: 'u32', O_RDWR: 'i32', O_SYNC: 'i32',
  O_DIRECTORY: 'i32', F_SETFL: 'i32', O_NONBLOCK: 'i32',
  EAGAIN: 'i32',
  WNOHANG: 'i32', SIGTERM: 'i32',
  MAP_SHARED: 'i32', MAP_ANONYMOUS: 'i32', MAP_PRIVATE: 'i32',
  MS_ASYNC: 'i32', MS_SYNC: 'i32', MS_INVALIDATE: 'i32',
  _SC_CLK_TCK: 'i32',
  F_GETFL: 'i32',
  RTLD_NOW: 'i32', RTLD_LAZY: 'i32', RTLD_GLOBAL: 'i32', RTLD_LOCAL: 'i32',
  RTLD_NODELETE: 'i32', RTLD_NOLOAD: 'i32',
  RTLD_DEFAULT: 'u64', RTLD_NEXT: 'u64',
  PROT_READ: 'i32', PROT_WRITE: 'i32', PROT_EXEC: 'i32', _SC_PAGESIZE: 'i32',
  DT_BLK: 'i32',
  DT_CHR: 'i32',
  DT_DIR: 'i32',
  DT_FIFO: 'i32',
  DT_LNK: 'i32',
  DT_REG: 'i32',
  DT_SOCK: 'i32',
  DT_UNKNOWN: 'i32',
}

const structs = ['clock_t', 'fastcall', 'struct stat', 'struct timespec', 'dev_t', 'ino_t', 'mode_t', 'nlink_t', 'uid_t', 'gid_t', 'off_t', 'blksize_t', 'blkcnt_t']

// list of headers to include
const includes = [
  'unistd.h', 'sys/stat.h', 'fcntl.h', 'dirent.h', 'dlfcn.h', 'sys/mman.h',
  'stdio.h', 'sys/wait.h', 'signal.h', 'sys/resource.h', 'sys/times.h', 'sys/reboot.h',
  'string.h', 'termios.h',
  // Real, direct requirements (malloc/calloc/realloc/aligned_alloc/free/
  // exit/getenv/setenv-family, EAGAIN) -- silently covered by bindings()
  // always including <v8.h> first, which transitively drags in enough
  // of the standard library to mask this. Same latent gap already found
  // and fixed the same way in lib/core_abi/lib/epoll/lib/net.
  'stdlib.h', 'limits.h', 'errno.h'
]

// i think this is cleanest way to do this for now. would be nice to come up 
// with a matrix of all syscalls for all environments and generate them automatically
const mac = {
  constants: {
    RTLD_FIRST: 'i32',
    RTLD_SELF: 'i64',
    RTLD_MAIN_ONLY: 'i64',
    MAP_JIT: 'i32'
  }
}

const linux = {
  constants: {
    LINUX_REBOOT_CMD_HALT: 'u32',
    LINUX_REBOOT_CMD_POWER_OFF: 'u32',
    LINUX_REBOOT_CMD_RESTART: 'u32',
    RB_POWER_OFF: 'i32',
    EINTR: 'i32',
    MFD_CLOEXEC: 'i32',
    MAP_HUGETLB: 'i32',
    MAP_HUGE_SHIFT: 'i32',
    MFD_HUGETLB: 'i32',
//    MAP_32BIT: 'i32', // this breaks arm64/linux build, even with -D_GNU_SOURCE defined
    MADV_HUGEPAGE: 'i32',
    MAP_FIXED: 'i32',
    POSIX_FADV_SEQUENTIAL: 'i32', POSIX_FADV_WILLNEED: 'i32', POSIX_FADV_RANDOM: 'i32',
    POSIX_FADV_DONTNEED: 'i32',
    S_IFLNK: 'i32'
  },
  includes: [
    'linux/reboot.h',
    'sys/ioctl.h',
    'dirent.h',
    'sched.h',
    'sys/sysmacros.h'
  ],
  api: {
    makedev: {
      parameters: ['u32', 'u32'],
      result: 'u32',
      name: 'makedev'
    },
    posix_fadvise: {
      parameters: ['i32', 'u32', 'u32', 'i32'],
      result: 'i32'
    },
    ioctl: {
      parameters: ['i32', 'u32', 'buffer'],
      result: 'i32',
    },
    ioctl2: {
      parameters: ['i32', 'u32', 'i32'],
      result: 'i32',
      name: 'ioctl',
    },
    ioctl3: {
      parameters: ['i32', 'u32', 'pointer'],
      result: 'i32',
      name: 'ioctl',
    },
    reboot: {
      parameters: ['i32'],
      result: 'i32',
    },
    getdents: {
      parameters: ['i32', 'pointer', 'u32'],
      pointers: [, 'struct dirent*'],
      result: 'u32',
      name: 'getdents64',
    },
    getaffinity: {
      parameters: ['i32', 'u32', 'pointer'],
      pointers: [, , 'cpu_set_t*'],
      result: 'i32',
      name: 'sched_getaffinity',
    },
    copy_file_range: {
      parameters: ['i32', 'pointer', 'i32', 'pointer', 'u32', 'u32'],
      pointers: [, 'loff_t*', , 'loff_t*'],
      result: 'u32',
    },
    memfd_create: {
      parameters: ['string', 'u32'],
      result: 'i32',
      man: 'https://man7.org/linux/man-pages/man2/memfd_create.2.html'
    },
    setaffinity: {
      parameters: ['i32', 'u32', 'pointer'],
      pointers: [, , 'cpu_set_t*'],
      result: 'i32',
      name: 'sched_setaffinity',
    },
    vfork: {
      parameters: [],
      result: 'i32'
    },
    vexecve: {
      parameters: ['string', 'pointer', 'pointer'],
      pointers: ['const char*', 'char* const*', 'char* const*'],
      result: 'i32',
    },
    vfexecve: {
      parameters: ['i32', 'buffer', 'buffer'],
      pointers: [, 'char* const*', 'char* const*'],
      result: 'i32',
    },
    getpagesize: {
      parameters: [],
      result: 'i32'
    },
    madvise: {
      parameters: ['pointer', 'u32', 'i32'],
      result: 'i32'
    }
  },
  structs: ['cpu_set_t']
}

// binding name
const name = 'core'
// system available libraries that need to be linked dynamically
const libs = ['dl'] // i.e. '-ldl' flag to gnu linker
// list of object files that should be linked into the library
const obj = []

export {
  api, includes, name, libs, obj, constants, preamble, structs,
  linux, mac
}

