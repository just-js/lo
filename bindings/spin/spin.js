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
    name: 'spin_create_isolate'
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
  contextSize: {
    parameters: [],
    result: 'i32',
    name: 'spin_context_size'
  }
}

const name = 'spin'

export { name, api }
