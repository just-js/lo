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
    parameters: ['pointer', 'pointer'],
    pointers: ['const char*', 'sqlite3 **'],
    result: 'i32'
  },
  open2: {
    name: 'sqlite3_open_v2',
    parameters: ['pointer', 'pointer', 'i32', 'pointer'],
    pointers: ['const char*', 'sqlite3 **', , 'const char*'],
    result: 'i32'
  },
  exec: {
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
    parameters: ['pointer', 'pointer', 'i32', 'pointer', 'pointer'],
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
  column_bytes: {
    name: 'sqlite3_column_bytes',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  }
}

const includes = ['sqlite3.h']
const name = 'sqlite'
const preamble = `typedef int (*callback)(void*,int,char**,char**);\n`
const obj = []
const libs = ['sqlite3']

export { api, includes, name, preamble, obj, libs }
