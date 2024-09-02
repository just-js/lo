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

const name = 'lz4'
const includes = ['lz4.h', 'lz4hc.h']
const libs = ['lz4']
const obj = []

export { api, includes, name, libs, obj }
