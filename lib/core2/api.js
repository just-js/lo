const api = {
  calloc: {
    parameters: ['u32', 'u32'],
    result: 'pointer'
  },
  read: {
    parameters: ['i32', 'pointer', 'i32'],
    result: 'i32',
    name: '_read'
  },
  write: {
    parameters: ['i32', 'pointer', 'i32'],
    result: 'i32',
    name: '_write'
  },
  write_string: {
    parameters: ['i32', 'string', 'i32'],
    pointers: [, 'const char*'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }],
    result: 'i32',
    name: '_write'
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
    result: 'i32',
    name: '_close'
  },
  lseek: {
    parameters: ['i32', 'u32', 'i32'],
    result: 'u32',
    name: '_lseek'
  },
  // https://github.com/wine-mirror/wine/blob/master/include/msvcrt/sys/stat.h#L52
  fstat: {
    parameters: ['i32', 'pointer'],
    pointers: [, 'struct _stat *'],
    result: 'i32',
    name: '_fstat'
  },
  rename: {
    parameters: ['string', 'string'],
    result: 'i32'
  },
  open: {
    parameters: ['string', 'i32', 'i32'],
    pointers: ['const char*'],
    result: 'i32',
    name: '_open'
  },
  unlink: {
    parameters: ['string'],
    result: 'i32',
    name: '_unlink'
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
  malloc: {
    parameters: ['u32'],
    result: 'pointer'
  },
  realloc: {
    parameters: ['pointer', 'u32'],
    result: 'pointer'
  },
  aligned_alloc: {
    parameters: ['u32', 'u32'],
    result: 'pointer',
    name: '_aligned_malloc'
  },
  free: {
    parameters: ['pointer'],
    result: 'void'
  },
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
  getenv: {
    parameters: ['string'],
    pointers: ['const char*'],
    rpointer: 'char*',
    result: 'pointer'
  },
  dup: {
    parameters: ['i32'],
    result: 'i32',
    name: '_dup'
  },
  dup2: {
    parameters: ['i32', 'i32'],
    result: 'i32',
    name: '_dup2'
  },
  getcwd: {
    parameters: ['pointer', 'i32'],
    pointers: ['char*'],
    result: 'pointer',
    name: '_getcwd'
  },
  getpid: {
    parameters: [],
    result: 'i32',
    name: '_getpid'
  },
  execve: {
    parameters: ['string', 'buffer', 'buffer'],
    pointers: ['const char*', 'char* const*', 'char* const*'],
    result: 'i32',
    name: '_execve'
  },
  execvp: {
    parameters: ['string', 'buffer'],
    pointers: ['const char*', 'char* const*'],
    result: 'i32',
    name: '_execvp'
  },
  exit: {
    parameters: ['i32'],
    result: 'void'
  },
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
    name: 'lo_create_isolate_context',
    nofast: true
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
  callback: {
    parameters: ['pointer'],
    pointers: ['exec_info*'],
    result: 'void',
    name: 'lo_callback',
    nofast: true
  },
  strnlen: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'u32'
  },
  isatty: {
    parameters: ['i32'],
    result: 'i32',
    name: '_isatty'
  },
}

// The generic dlopen'd-FFI-call machinery (struct fastcall, SlowCallback,
// bind_fastcallSlow/bind_slowcallSlow, CTypeFromV8, needsunwrap,
// lo_fastcall) used to be duplicated here near-verbatim from lib/core's
// own former copy (WORK.md's E.7) -- both now share one real definition
// in lo.h/lo_ffi.cc instead, including the Windows `#define strdup
// _strdup` compat shim this file's own preamble used to carry.
const preamble = ''
const includes = ['io.h', 'direct.h', 'process.h']
const name = 'core'
const libs = []
const obj = []
const constants = {
  S_IFCHR: 'i32', O_RDONLY: 'i32', O_WRONLY: 'i32', O_CREAT: 'i32', 
  O_TRUNC: 'i32', STDIN: 0, STDOUT: 1, STDERR: 2, SEEK_SET: 'i32', 
  SEEK_CUR: 'i32', SEEK_END: 'i32', S_IFMT: 'i32', S_IFDIR: 'i32',
  S_IFREG: 'i32', O_RDWR: 'i32', EAGAIN: 'i32',
  // WIN Specific
  _S_IREAD: 'i32',
  _S_IWRITE: 'i32',
  _O_APPEND: 'i32',
  _O_BINARY: 'i32',
  _O_CREAT: 'i32',
  _O_RDONLY: 'i32',
  _O_RDWR: 'i32',
  _O_TEXT: 'i32',
  _O_TRUNC: 'i32',
  _O_WRONLY: 'i32',
  _O_U16TEXT: 'i32',
  _O_U8TEXT: 'i32',
}

const structs = ['fastcall']

export {
  api, includes, name, libs, obj, constants, structs, preamble
}
