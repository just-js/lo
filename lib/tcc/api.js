const api = {
  create: {
    parameters: [],
    result: 'pointer',
    name : 'tcc_new'
  },
  delete: {
    parameters: ['pointer'],
    pointers: ['TCCState*'],
    result: 'void',
    name : 'tcc_delete'
  },
  set_output_type: {
    parameters: ['pointer', 'i32'],
    pointers: ['TCCState*'],
    result: 'i32',
    name : 'tcc_set_output_type'
  },
  set_options: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'void',
    name : 'tcc_set_options'
  },
  add_library_path: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32',
    name : 'tcc_add_library_path'
  },
  add_library: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32',
    name : 'tcc_add_library'
  },
  add_include_path: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32',
    name : 'tcc_add_include_path'
  },
  add_file: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32',
    name : 'tcc_add_file'
  },
  compile_string: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32',
    name : 'tcc_compile_string'
  },
  relocate: {
    parameters: ['pointer'],
    pointers: ['TCCState*'],
    result: 'i32',
    name : 'tcc_relocate'
  },
  get_symbol: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'pointer',
    name : 'tcc_get_symbol'
  },
  add_symbol: {
    parameters: ['pointer', 'string', 'pointer'],
    pointers: ['TCCState*', 'const char*', 'const void*'],
    result: 'i32',
    name : 'tcc_add_symbol'
  },
  output_file: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32',
    name : 'tcc_output_file'
  },
  list_symbols: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['TCCState*'],
    casts: [, , '(void (*)(void *ctx, const char *name, const void *val))'],
    result: 'void',
    name : 'tcc_list_symbols'
  }
}

const name = 'tcc'
const includes = ['deps/libtcc/libtcc.h']
//const libs = ['tcc']
const libs = []
const obj = ['deps/libtcc/libtcc.a']

export { api, includes, name, libs, obj }
