const api = {
  init: {
    parameters: ['buffer', 'i32'],
    pointers: ['dasm_State **'],
    result: 'void',
    name: 'dasm_init'
  },
  free: {
    parameters: ['buffer'],
    pointers: ['dasm_State **'],
    result: 'void',
    name: 'dasm_free'
  },
  setupglobal: {
    parameters: ['buffer', 'buffer', 'u32'],
    pointers: ['dasm_State **', 'void**'],
    result: 'void',
    name: 'dasm_setupglobal'
  },
  growpc: {
    parameters: ['buffer', 'u32'],
    pointers: ['dasm_State **'],
    result: 'void',
    name: 'dasm_growpc'
  },
  setup: {
    parameters: ['buffer', 'pointer'],
    pointers: ['dasm_State **', 'const void*'],
    result: 'void',
    name: 'dasm_setup'
  },
  put: {
    parameters: ['buffer', 'i32', 'i32'],
    pointers: ['dasm_State **'],
    result: 'void',
    name: 'dasm_put'
  },
  link: {
    parameters: ['buffer', 'u32array'],
    pointers: ['dasm_State **', 'size_t*'],
    result: 'i32',
    name: 'dasm_link'
  },
  encode: {
    parameters: ['buffer', 'pointer'],
    pointers: ['dasm_State **'],
    result: 'i32',
    name: 'dasm_encode'
  },
  getpclabel: {
    parameters: ['buffer', 'u32'],
    pointers: ['dasm_State **'],
    result: 'i32',
    name: 'dasm_getpclabel'
  },  
}

const includes = ['dasm_proto.h', 'dasm_x86.h']
const name = 'dynasm'

export { name, includes, api }
