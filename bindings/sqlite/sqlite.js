const api = {
  sqlite3_libversion: {
    parameters: [],
    pointers: [],
    rpointer: 'const char*',
    result: 'pointer',
    name: 'version'
  },
  sqlite3_open: {
    name: 'open',
    parameters: ['pointer', 'pointer'],
    pointers: ['const char*', 'sqlite3 **'],
    result: 'i32'
  },
  sqlite3_open_v2: {
    name: 'open2',
    parameters: ['pointer', 'pointer', 'i32', 'pointer'],
    pointers: ['const char*', 'sqlite3 **', , 'const char*'],
    result: 'i32'
  },
  sqlite3_exec: {
    name: 'exec',
    parameters: ['pointer', 'pointer', 'pointer', 'pointer', 'pointer'],
    pointers: ['sqlite3*', 'const char*', 'callback',, 'char**'],
    result: 'i32'
  },
  sqlite3_errmsg: {
    name: 'errmsg',
    parameters: ['pointer'],
    pointers: ['sqlite3*'],
    rpointer: 'const char*',
    result: 'pointer'
  },
  sqlite3_close_v2: {
    name: 'close2',
    parameters: ['pointer'],
    pointers: ['sqlite3*'],
    result: 'i32'
  },
  sqlite3_prepare_v2: {
    name: 'prepare2',
    parameters: ['pointer', 'pointer', 'i32', 'pointer', 'pointer'],
    pointers: ['sqlite3*', 'const char*', ,'sqlite3_stmt **', 'const char**'],
    result: 'i32'
  },
  sqlite3_finalize: {
    name: 'finalize',
    parameters: ['pointer'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  sqlite3_column_count: {
    name: 'column_count',
    parameters: ['pointer'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  sqlite3_column_type: {
    name: 'column_type',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  sqlite3_column_name: {
    name: 'column_name',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    rpointer: 'const char*',
    result: 'pointer'
  },
  sqlite3_step: {
    name: 'step',
    parameters: ['pointer'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  sqlite3_reset: {
    name: 'reset',
    parameters: ['pointer'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  sqlite3_column_int: {
    name: 'column_int',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    result: 'i32'
  },
  sqlite3_column_double: {
    name: 'column_double',
    parameters: ['pointer', 'i32'],
    pointers: ['sqlite3_stmt*'],
    result: 'f32'
  },
  sqlite3_column_text: {
    name: 'column_text',
    parameters: ['pointer', 'i32'],
    rpointer: 'const unsigned char*',
    pointers: ['sqlite3_stmt*'],
    result: 'pointer'
  },
  sqlite3_column_bytes: {
    name: 'column_bytes',
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
