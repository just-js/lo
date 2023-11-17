const api = {
// dynamic loader
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
    platform: ['linux', 'mac', 'posix'],
    man: 'https://pubs.opengroup.org/onlinepubs/9699919799/functions/dlopen.html'
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
// file descriptor operations
  read: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  write: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  write_string: {
    parameters: ['i32', 'string', 'i32'],
    pointers: [, 'const char*'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }],
    result: 'i32',
    name: 'write'
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
// file system operations
  open: {
    parameters: ['string', 'i32', 'i32'],
    pointers: ['const char*'],
    result: 'i32'
  },
  unlink: {
    parameters: ['string'],
    result: 'i32'
  },
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
  mkdir: {
    parameters: ['string', 'u32'],
    result: 'i32',
  },
  closedir: {
    parameters: ['pointer'],
    pointers: ['DIR*'],
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
  memmove: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  mmap: {
    parameters: ['pointer', 'u32', 'i32', 'i32', 'i32', 'u32'],
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
    result: 'i32',
    platform: ['linux'],
    man: 'https://man7.org/linux/man-pages/man2/memfd_create.2.html'
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
    name: 'lo_fastcall'
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
    os: [],
    arch: [],
    nofast: true
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
    name: 'lo_create_isolate_context'
  },
  isolate_context_destroy: {
    parameters: ['buffer'],
    pointers: ['struct isolate_context*'],
    result: 'void',
    name: 'lo_destroy_isolate_context'
  },
  isolate_context_size: {
    parameters: [],
    result: 'i32',
    name: 'lo_context_size'
  },
  isolate_start: {
    parameters: ['buffer'],
    result: 'void',
    name: 'lo_start_isolate',
    nofast: true
  },
}

export { api }
