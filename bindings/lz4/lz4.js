const api = {
  compress_default: {
    parameters: ['pointer', 'pointer', 'i32', 'i32'],
    pointers: ['const char*', 'char*'],
    result: 'i32',
    name: 'LZ4_compress_default'
  },
  compress_hc: {
    parameters: ['pointer', 'pointer', 'i32', 'i32', 'i32'],
    pointers: ['const char*', 'char*'],
    result: 'i32',
    name: 'LZ4_compress_HC'
  },
  decompress_safe: {
    parameters: ['pointer', 'pointer', 'i32', 'i32'],
    pointers: ['const char*', 'char*'],
    result: 'i32',
    name: 'LZ4_decompress_safe'
  }
}

// TODO depdendencies in makefile

const name = 'lz4'
const includes = ['liblz4.h']
const libs = []
const obj = []

export { api, includes, name, libs, obj }
