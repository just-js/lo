const api = {
  ffi_prep_cif: {
    parameters: ['pointer', 'u32', 'u32', 'pointer', 'pointer'],
    pointers: ['ffi_cif*', , , 'ffi_type*', 'ffi_type**'],
    casts: [, 'ffi_abi'],
    result: 'i32'
  },
  ffi_call: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer'],
    pointers: ['ffi_cif*', 'callback', , 'void**'],
    result: 'void'
  }
}

const libs = ['ffi']
const includes = ['ffi.h']
const name = 'ffi'
const preamble = `typedef void (*callback)();\n`

export { api, includes, name, preamble, libs }
