const api = {
  tcc_new: {
    parameters: [],
    result: 'pointer'
  },
  tcc_set_output_type: {
    parameters: ['pointer', 'i32'],
    pointers: ['TCCState*'],
    result: 'i32'
  },
  tcc_set_options: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'void'
  },
  tcc_add_include_path: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_add_file: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_compile_string: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_relocate: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'void*'],
    result: 'i32'
  },
  tcc_get_symbol: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*'],
    result: 'pointer'
  },
  tcc_add_symbol: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['TCCState*', 'const char*', 'const void*'],
    result: 'i32'
  }
}

const name = 'tcc'
const includes = ['libtcc.h']
const libs = ['']
const obj = ['tcc.a']

export { api, includes, name, libs, obj }
