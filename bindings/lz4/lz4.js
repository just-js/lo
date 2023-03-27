const api = {
  LZ4_compress_default: {
    parameters: ['buffer', 'buffer', 'i32', 'i32'],
    pointers: ['const char*', 'char*'],
    result: 'i32'
  },
  LZ4_compress_HC: {
    parameters: ['buffer', 'buffer', 'i32', 'i32', 'i32'],
    pointers: ['const char*', 'char*'],
    result: 'i32'
  }
}

const name = 'lz4'
const includes = ['liblz4.h']
const libs = []
const obj = []

export { api, includes, name, libs, obj }
