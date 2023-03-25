const api = {
  close: {
    parameters: ['i32'],
    result: 'i32'
  },
  open: {
    parameters: ['pointer', 'i32', 'i32'],
    pointers: ['const char*'],
    result: 'i32'
  },
  read: {
    parameters: ['i32', 'pointer', 'i32'],
    result: 'i32'
  },
  lseek: {
    parameters: ['i32', 'u32', 'i32'],
    result: 'u32'
  },
  write_string: {
    parameters: ['i32', 'string', 'i32'],
    pointers: [, 'const char*'],
    result: 'i32',
    name: 'write'
  },
  write: {
    parameters: ['i32', 'pointer', 'i32'],
    result: 'i32'
  },
  fstat: {
    parameters: ['i32', 'pointer'],
    pointers: [, 'struct stat *'],
    result: 'i32'
  }
}

const includes = ['unistd.h', 'sys/stat.h', 'fcntl.h']
const name = 'fs'

export { api, includes, name }
