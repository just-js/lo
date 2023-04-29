const api = {
  close: {
    parameters: ['pointer'],
    pointers: ['rocksdb_t*'],
    result: 'void',
    name: 'rocksdb_close'
  },
  open: {
    parameters: ['pointer', 'string', 'u32array'],
    pointers: ['const rocksdb_options_t*', , 'char**'],
    result: 'pointer',
    rpointer: 'rocksdb_t*',
    name: 'rocksdb_open'
  },
  options_create: {
    parameters: [],
    result: 'pointer',
    rpointer: 'rocksdb_options_t*',
    name: 'rocksdb_options_create'
  },
  readoptions_create: {
    parameters: [],
    result: 'pointer',
    rpointer: 'rocksdb_readoptions_t*',
    name: 'rocksdb_readoptions_create'
  },
  writeoptions_create: {
    parameters: [],
    result: 'pointer',
    rpointer: 'rocksdb_writeoptions_t*',
    name: 'rocksdb_writeoptions_create'
  },
  options_set_create_if_missing: {
    parameters: ['pointer', 'u8'],
    pointers: ['rocksdb_options_t*'],
    result: 'void',
    name: 'rocksdb_options_set_create_if_missing'
  },
  put_string: {
    parameters: ['pointer', 'pointer', 'string', 'u32', 'string', 'u32', 'u32array'],
    pointers: ['rocksdb_t*', 'rocksdb_writeoptions_t*', 'const char*', , 'const char*', , 'char**'],
    result: 'void',
    name: 'rocksdb_put'
  },
  get: {
    parameters: ['pointer', 'pointer', 'string', 'u32', 'u32array', 'u32array'],
    pointers: ['rocksdb_t*', 'rocksdb_readoptions_t*', 'const char*', , 'size_t*', 'char**'],
    result: 'pointer',
    rpointer: 'char*',
    name: 'rocksdb_get'
  },
  delete: {
    parameters: ['pointer', 'pointer', 'string', 'u32', 'u32array'],
    pointers: ['rocksdb_t*', 'rocksdb_writeoptions_t*', 'const char*', , 'char**'],
    result: 'void',
    name: 'rocksdb_delete'
  }
}

const name = 'rocksdb'
const obj = ['librocksdb.a']
const includes = ['c.h']

export { api, obj, includes, name }
