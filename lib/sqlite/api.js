const api = {
  version: {
    parameters: [],
    pointers: [],
    rpointer: 'const char*',
    result: 'pointer',
    name: 'sqlite3_libversion'
  },
  open: {
    name: 'sqlite3_open',
    parameters: ['pointer', 'u32array'],
    pointers: ['const char*', 'sqlite3 **'],
    result: 'i32'
  },
  open2: {
    name: 'sqlite3_open_v2',
    parameters: ['string', 'u32array', 'i32', 'pointer'],
    pointers: ['const char*', 'sqlite3 **', , 'const char*'],
    result: 'i32'
  },
  exec: {
    name: 'sqlite3_exec',
    parameters: ['pointer', 'string', 'pointer', 'pointer', 'u32array'],
    pointers: ['sqlite3*', 'const char*', 'callback',, 'char**'],
    result: 'i32'
  },
  exec2: {
    name: 'sqlite3_exec',
    parameters: ['pointer', 'string', 'pointer', 'pointer', 'u32array'],
    pointers: ['sqlite3*', 'const char*', 'callback',, 'char**'],
    result: 'i32',
    nofast: true
  },
  exec3: {
    name: 'sqlite3_exec',
    parameters: ['pointer', 'pointer', 'pointer', 'pointer', 'pointer'],
    pointers: ['sqlite3*', 'const char*', 'callback',, 'char**'],
    result: 'i32',
    nofast: true
  },
  exec4: {
    name: 'sqlite3_exec',
    parameters: ['pointer', 'pointer', 'pointer', 'pointer', 'pointer'],
    pointers: ['sqlite3*', 'const char*', 'callback',, 'char**'],
    result: 'i32'
  },
  errmsg: {
    name: 'sqlite3_errmsg',
    parameters: ['pointer'],
    pointers: ['sqlite3*'],
    rpointer: 'const char*',
    result: 'pointer'
  },
  close2: {
    name: 'sqlite3_close_v2',
    parameters: ['pointer'],
    pointers: ['sqlite3*'],
    result: 'i32'
  },
  prepare2: {
    name: 'sqlite3_prepare_v2',
    parameters: ['pointer', 'string', 'i32', 'u32array', 'pointer'],
    pointers: ['sqlite3*', 'const char*', ,'sqlite3_stmt **', 'const char**'],
    result: 'i32'
  },
  finalize: {
    name: 'sqlite3_finalize',
    parameters: ['pointer'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  column_count: {
    name: 'sqlite3_column_count',
    parameters: ['pointer'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  column_type: {
    name: 'sqlite3_column_type',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  column_name: {
    name: 'sqlite3_column_name',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    rpointer: 'const char*',
    result: 'pointer'
  },
  step: {
    name: 'sqlite3_step',
    parameters: ['pointer'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  reset: {
    name: 'sqlite3_reset',
    parameters: ['pointer'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  bind_int: {
    name: 'sqlite3_bind_int',
    parameters: ['pointer', 'i32', 'i32'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  bind_int64: {
    name: 'sqlite3_bind_int64',
    parameters: ['pointer', 'i32', 'u64'],
    casts: [, , '(sqlite3_int64)'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  bind_double: {
    name: 'sqlite3_bind_double',
    parameters: ['pointer', 'i32', 'f64'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  bind_text: {
    name: 'sqlite3_bind_text',
    parameters: ['pointer', 'i32', 'string', 'i32', 'u64'],
    casts: [, , , , '(sqlite3_destructor_type)'],
    pointers: ['sqlite3_stmt*', , 'const char*'],
    result: 'i32'
  },
  bind_blob: {
    name: 'sqlite3_bind_blob',
    parameters: ['pointer', 'i32', 'buffer', 'i32', 'u64'],
    casts: [, , , , '(sqlite3_destructor_type)'],
    pointers: ['sqlite3_stmt*', , 'const void*'],
    result: 'i32'
  },
  column_int: {
    name: 'sqlite3_column_int',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  column_double: {
    name: 'sqlite3_column_double',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    result: 'f32'
  },
  column_text: {
    name: 'sqlite3_column_text',
    parameters: ['pointer', 'i32'],
    rpointer: 'const unsigned char*',
    pointers: ['sqlite3_stmt*'],
    result: 'pointer'
  },
  column_blob: {
    name: 'sqlite3_column_blob',
    parameters: ['pointer', 'i32'],
    rpointer: 'const void*',
    pointers: ['sqlite3_stmt*'],
    result: 'pointer'
  },
  column_bytes: {
    name: 'sqlite3_column_bytes',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  blob_open: {
    name: 'sqlite3_blob_open',
    parameters: ['pointer', 'string', 'string', 'string', 'i64', 'i32', 'u32array'],
    pointers: ['sqlite3*', , , , , , 'sqlite3_blob**'],
    result: 'i32'
  },
  blob_bytes: {
    name: 'sqlite3_blob_bytes',
    parameters: ['pointer'],
    pointers: ['sqlite3_blob*'],
    result: 'i32'
  },
  blob_read: {
    name: 'sqlite3_blob_read',
    parameters: ['pointer', 'buffer', 'i32', 'i32'],
    pointers: ['sqlite3_blob*'],
    result: 'i32'
  },
  blob_close: {
    name: 'sqlite3_blob_close',
    parameters: ['pointer'],
    pointers: ['sqlite3_blob*'],
    result: 'i32'
  },
  blob_write: {
    name: 'sqlite3_blob_write',
    parameters: ['pointer', 'buffer', 'i32', 'i32'],
    pointers: ['sqlite3_blob*'],
    result: 'i32'
  },
  serialize: {
    name: 'sqlite3_serialize',
    parameters: ['pointer', 'string', 'u32array', 'u32'],
    pointers: ['sqlite3*', , 'sqlite3_int64*'],
    result: 'pointer',
    rpointer: 'unsigned char*'
  },
  deserialize: {
    name: 'sqlite3_deserialize',
    parameters: ['pointer', 'string', 'buffer', 'u32', 'u32', 'u32'],
    pointers: ['sqlite3*', , 'unsigned char*'],
    result: 'i32'
  },
  initialize: {
    name: 'sqlite3_initialize',
    parameters: [],
    result: 'i32'
  },
}

/*
sqlite3_bind_null
sqlite3_bind_parameter_count
sqlite3_bind_parameter_index
sqlite3_bind_parameter_name
sqlite3_bind_zeroblob
sqlite3_changes
sqlite3_clear_bindings
sqlite3_create_function_v2
sqlite3_data_count
sqlite3_deserialize
sqlite3_errcode
sqlite3_errmsg
sqlite3_errstr
sqlite3_file_control
sqlite3_free
sqlite3_malloc64
sqlite3_initialize
sqlite3_interrupt
sqlite3_memory_used
sqlite3_serialize
sqlite3_shutdown
sqlite3_sql
sqlite3_wal_checkpoint_v2
sqlite3_wal_hook
*/

const includes = ['sqlite3.h']
const name = 'sqlite'
const preamble = `typedef int (*callback)(void*,int,char**,char**);\n`
//const obj = []
//const libs = ['sqlite3']
const libs = []
const obj = ['deps/sqlite/libsqlite3.a']
const constants = {
  SQLITE_OPEN_READWRITE: 'i32', SQLITE_OPEN_PRIVATECACHE: 'i32',
  SQLITE_ROW: 'i32', SQLITE_OPEN_NOMUTEX: 'i32', SQLITE_OPEN_CREATE: 'i32',
  SQLITE_OK: 'i32', SQLITE_OPEN_READONLY: 'i32'
}
const include_paths = ['deps/sqlite']

export { api, includes, name, preamble, obj, libs, constants, include_paths }
