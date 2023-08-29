const api = {
  createIsolate: {
    parameters: [
      'i32', 'u32array', 'string', 'u32', 'string', 'u32', 'buffer', 
      'i32', 'i32', 'u64', 'string', 'string', 'i32', 'i32', 'pointer'
    ],
    pointers: [
      , 'char**', 'const char*', , 'const char*', , 'char*', , , 
      'const char*', 'const char*'
    ],
    result: 'i32',
    name: 'spin_create_isolate',
    nofast: true
  },
  createIsolateContext: {
    parameters: [
      'i32', 'u32array', 'string', 'u32', 'string', 'u32', 'buffer', 
      'i32', 'i32', 'u64', 'string', 'string', 'i32', 'i32', 'pointer', 'buffer'
    ],
    pointers: [
      , 'char**', 'const char*', , 'const char*', , 'char*', , , 
      'const char*', 'const char*', , , , , 'struct isolate_context*'
    ],
    result: 'void',
    name: 'spin_create_isolate_context'
  },
  createIsolateContext2: {
    parameters: [
      'i32', 'pointer', 'string', 'u32', 'string', 'u32', 'pointer', 
      'i32', 'i32', 'u64', 'string', 'string', 'i32', 'i32', 'pointer', 'buffer'
    ],
    pointers: [
      , 'char**', 'const char*', , 'const char*', , 'char*', , , 
      'const char*', 'const char*', , , , , 'struct isolate_context*'
    ],
    result: 'void',
    name: 'spin_create_isolate_context'
  },
  destroyIsolateContext: {
    parameters: ['buffer'],
    pointers: ['struct isolate_context*'],
    result: 'void',
    name: 'spin_destroy_isolate_context'
  },
  contextSize: {
    parameters: [],
    result: 'i32',
    name: 'spin_context_size'
  },
  startIsolate: {
    parameters: ['buffer'],
    result: 'void',
    name: 'spin_start_isolate',
    nofast: true
  },
  callCallback: {
    parameters: ['pointer'],
    pointers: ['exec_info*'],
    result: 'void',
    name: 'spin_callback',
    nofast: true
  },
  ffi_call: {
    parameters: ['pointer'],
    result: 'void',
    name: 'spin_ffi_call',
    nofast: false
  },
  ffi_syscall: {
    parameters: ['pointer'],
    result: 'void',
    name: 'spin_ffi_syscall',
    nofast: false
  },
  fastcall: {
    parameters: ['pointer'],
    pointers: ['void**'],
    result: 'void',
    name: 'spin_fastcall',
    nofast: false
  }
}

const preamble = `
#ifdef __cplusplus
extern "C"
    {
#endif
extern void spin_ffi_call(void* state);
extern void spin_ffi_syscall(void* state);
#ifdef __cplusplus
    }
#endif

typedef void (*spin_fast_call)(void*);

void spin_fastcall (void** state) {
  ((spin_fast_call)state[8])(state);
}
`

const make = `
ffi_call.o:
	as -o ffi_call.o ffi_call.S
`
const obj = ['ffi_call.o']
const name = 'spin'

export { name, api, make, obj, preamble }
