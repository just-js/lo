const api = {
  ffi_prep_cif: {
    parameters: ['pointer', 'u32', 'u32', 'pointer', 'pointer'],
    pointers: ['ffi_cif*', , , 'ffi_type*', 'ffi_type**'],
    casts: [, 'ffi_abi'],
    result: 'i32'
  },
  ffi_call: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer'],
    pointers: ['ffi_cif*', 'void(*fn)()', , 'void**']
  }
}

const includes = ['ffi.h']
const name = 'ffi'

export { api, includes, name }
