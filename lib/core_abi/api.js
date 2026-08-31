// core_abi: lib/core's real syscall surface, ported to lo_abi.h, with no
// V8-specific FFI machinery at all. lib/core/api.js's own `bind_fastcall`/
// `bind_slowcall`/`fastcall` entries and its preamble (struct fastcall,
// SlowCallback, CTypeFromV8, bind_fastcallSlow/bind_slowcallSlow) exist
// only to support core's dlopen'd-library FFI story (lib/ffi.js) by
// talking to v8:: directly -- that mechanism has no ABI equivalent (and
// is exactly what WORK.md's E.5 scopes separately, porting it onto this
// same three-tier dispatch design, not redoing it here) -- so this file
// drops that trio and the preamble entirely, keeping only the plain
// syscalls, which were never anything but real C functions declared via
// `includes` in the first place. Also dropped: `write_string`/
// `strnlen_str` (per-function `override`, not supported by bindingsAbi()
// yet -- `write`/`strnlen` cover the same real functions without it),
// and the `isolate_*`/`callback` family (embedder-internal, and
// `isolate_create`/`isolate_context_create` use `u32array`, not
// supported yet either).

const api = {
// dynamic loader
  dlopen: {
    parameters: ['string', 'i32'],
    result: 'pointer'
  },
  dlsym: {
    parameters: ['pointer', 'string'],
    result: 'pointer'
  },
  dlclose: {
    parameters: ['pointer'],
    result: 'i32'
  },
  dlerror: {
    parameters: [],
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
    result: 'i32'
  },
  lstat: {
    parameters: ['string', 'buffer'],
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
    result: 'i32'
  },
  unlink: {
    parameters: ['string'],
    result: 'i32'
  },
  readlink: {
    parameters: ['string', 'buffer', 'u32'],
    result: 'u32'
  },
  fstatat: {
    parameters: ['i32', 'string', 'buffer', 'i32'],
    result: 'i32'
  },
  mkdir: {
    parameters: ['string', 'u32'],
    result: 'i32'
  },
  rmdir: {
    parameters: ['string'],
    result: 'i32'
  },
  chdir: {
    parameters: ['string'],
    result: 'i32'
  },
  fchdir: {
    parameters: ['i32'],
    result: 'i32'
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
  shm_open: {
    parameters: ['string', 'i32', 'i32'],
    result: 'i32'
  },
  shm_unlink: {
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
// system
  getenv: {
    parameters: ['string'],
    result: 'pointer'
  },
  setenv: {
    parameters: ['string', 'string', 'i32'],
    result: 'i32'
  },
  unsetenv: {
    parameters: ['string'],
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
    result: 'i32'
  },
  execvp: {
    parameters: ['string', 'buffer'],
    result: 'i32'
  },
  execve: {
    parameters: ['string', 'buffer', 'buffer'],
    result: 'i32'
  },
  isatty: {
    parameters: ['i32'],
    result: 'i32'
  },
  tcgetattr: {
    parameters: ['i32', 'buffer'],
    result: 'i32'
  },
  tcsetattr: {
    parameters: ['i32', 'i32', 'buffer'],
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
    result: 'i32'
  },
  times: {
    parameters: ['buffer'],
    result: 'u32'
  },
// strings
  memmem: {
    parameters: ['pointer', 'u32', 'pointer', 'u32'],
    result: 'pointer'
  },
  strnlen: {
    parameters: ['pointer', 'u32'],
    result: 'u32'
  },
  symlink: {
    parameters: ['string', 'string'],
    result: 'i32'
  },
  sync: {
    parameters: [],
    result: 'void'
  }
}

// Same constants as lib/core/api.js, minus nothing -- every one of these
// is already 'i32'/'u32'/'u64', all supported by lo_exports_set_i32/u64.
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
  DT_UNKNOWN: 'i32'
}

// Same as lib/core/api.js's own `structs` list, minus 'fastcall' (only
// meaningful alongside the preamble this file drops).
const structs = ['clock_t', 'struct stat', 'struct timespec', 'dev_t', 'ino_t',
  'mode_t', 'nlink_t', 'uid_t', 'gid_t', 'off_t', 'blksize_t', 'blkcnt_t']

// stdlib.h/limits.h/errno.h are real, direct requirements (malloc/free/
// exit/getenv/setenv family, NAME_MAX, EAGAIN) that were silently
// covered by lib/core/api.js's own includes list missing them too --
// bindings() (the V8-specific target) always includes <v8.h> first,
// which transitively drags in enough of libstdc++/libc's headers to
// mask the gap. The abi target doesn't include any engine header at
// all (the whole point), so this had to be made explicit here -- a real
// gap this file's own first build surfaced, not present in lib/core
// only because nothing has ever removed its own accidental v8.h safety
// net to notice.
const includes = [
  'unistd.h', 'sys/stat.h', 'fcntl.h', 'dirent.h', 'dlfcn.h', 'sys/mman.h',
  'stdio.h', 'sys/wait.h', 'signal.h', 'sys/resource.h', 'sys/times.h',
  'string.h', 'termios.h', 'stdlib.h', 'limits.h', 'errno.h'
]

const name = 'core_abi'
const target = 'abi'
const libs = ['dl']

export { api, includes, name, libs, constants, structs, target }
