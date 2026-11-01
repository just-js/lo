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
    parameters: ['string', 'pointer', 'i32', 'pointer'],
    pointers: ['const char*', 'sqlite3 **', , 'const char*'],
    result: 'i32'
  },
  exec: {
    name: 'sqlite3_exec',
    parameters: ['pointer', 'string', 'pointer', 'pointer', 'pointer'],
    pointers: ['sqlite3*', 'const char*', 'callback',, 'char**'],
    result: 'i32'
  },
  exec2: {
    name: 'sqlite3_exec',
    parameters: ['pointer', 'string', 'pointer', 'pointer', 'pointer'],
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
    parameters: ['pointer', 'string', 'i32', 'pointer', 'pointer'],
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
    parameters: ['pointer', 'i32', 'pointer', 'i32', 'u64'],
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
  column_json_into: {
    parameters: ['pointer', 'i32', 'pointer'],
    pointers: ['sqlite3_stmt*', , 'char*'],
    result: 'i32',
    name: 'lo_sqlite_column_json_into'
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
    parameters: ['pointer', 'string', 'string', 'string', 'i64', 'i32', 'pointer'],
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
    parameters: ['pointer', 'pointer', 'i32', 'i32'],
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
    parameters: ['pointer', 'pointer', 'i32', 'i32'],
    pointers: ['sqlite3_blob*'],
    result: 'i32'
  },
  serialize: {
    name: 'sqlite3_serialize',
    parameters: ['pointer', 'string', 'pointer', 'u32'],
    pointers: ['sqlite3*', , 'sqlite3_int64*'],
    result: 'pointer',
    rpointer: 'unsigned char*'
  },
  deserialize: {
    name: 'sqlite3_deserialize',
    parameters: ['pointer', 'string', 'pointer', 'u32', 'u32', 'u32'],
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
const preamble = `typedef int (*callback)(void*,int,char**,char**);

// copy text column col of the current row into dst as the inside of a JSON
// string (no quotes), escaping the double quote, the backslash and control
// bytes; returns bytes written. dst needs room for 6x the column bytes in the
// worst case. scans 8 bytes at a time (SWAR) and copies runs that need no
// escaping with one memcpy
static const char lo_hex[] = "0123456789abcdef";
static inline uint64_t lo_json_special (uint64_t x) {
  const uint64_t ones = 0x0101010101010101ULL, high = 0x8080808080808080ULL;
  uint64_t q = x ^ (ones * 0x22), b = x ^ (ones * 0x5c);
  // flags bytes < 0x20, == 0x22 or == 0x5c; bytes >= 0x80 never are
  return (((x - ones * 0x20) & ~x) | ((q - ones) & ~q) | ((b - ones) & ~b)) & high;
}
int lo_sqlite_column_json_into (sqlite3_stmt* stmt, int col, char* dst) {
  const unsigned char* src = sqlite3_column_text(stmt, col);
  int len = sqlite3_column_bytes(stmt, col);
  if (!src) return 0;
  char* o = dst;
  int i = 0, run = 0;
  while (i < len) {
    if (i + 8 <= len) {
      uint64_t x;
      __builtin_memcpy(&x, src + i, 8);
      if (!lo_json_special(x)) { i += 8; continue; }
    }
    unsigned char c = src[i];
    if (c >= 0x20 && c != 0x22 && c != 0x5c) { i++; continue; }
    __builtin_memcpy(o, src + run, i - run);
    o += i - run;
    *o++ = 0x5c;
    if (c == 0x22 || c == 0x5c) *o++ = c;
    else if (c == 0x0a) *o++ = 0x6e;
    else if (c == 0x0d) *o++ = 0x72;
    else if (c == 0x09) *o++ = 0x74;
    else if (c == 0x08) *o++ = 0x62;
    else if (c == 0x0c) *o++ = 0x66;
    else { *o++ = 0x75; *o++ = 0x30; *o++ = 0x30; *o++ = lo_hex[c >> 4]; *o++ = lo_hex[c & 15]; }
    run = ++i;
  }
  __builtin_memcpy(o, src + run, len - run);
  return (int)(o - dst) + (len - run);
}
`
//const obj = []
//const libs = ['sqlite3']
const libs = []
const obj = ['deps/sqlite/libsqlite3.a']
const constants = {
  SQLITE_OPEN_READWRITE: 'i32', SQLITE_OPEN_PRIVATECACHE: 'i32',
  SQLITE_ROW: 'i32', SQLITE_OPEN_NOMUTEX: 'i32', SQLITE_OPEN_CREATE: 'i32',
  SQLITE_OK: 'i32', SQLITE_OPEN_READONLY: 'i32', SQLITE_DONE: 'i32'
}
const include_paths = ['deps/sqlite']

// how lib/sqlite/build.js configures the sqlite library (the static archive
// and, with LO_SQLITE_SHARED=1, libsqlite3.so). https://www.sqlite.org/compile.html
const library = {
  // always on
  base: [
    '-DHAVE_FDATASYNC=1',
    '-DSQLITE_DQS=0',
    '-DSQLITE_OMIT_COMPLETE=1',
    '-DSQLITE_OMIT_DEPRECATED=1',
    '-DSQLITE_OMIT_GET_TABLE=1',
    '-DSQLITE_OMIT_LOAD_EXTENSION=1',
    '-DSQLITE_OMIT_TCL_VARIABLE=1',
    '-DSQLITE_TRACE_SIZE_LIMIT=32'
  ],
  // perf mode, on by default (LO_SQLITE_PERF=0 turns it off): tuned for a
  // single process and thread using WAL. also configures without threads.
  // locking mode and foreign keys are left to pragmas
  perf: [
    '-DSQLITE_DEFAULT_MEMSTATUS=0',
    '-DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1',
    '-DSQLITE_LIKE_DOESNT_MATCH_BLOBS=1',
    '-DSQLITE_MAX_EXPR_DEPTH=0',
    '-DSQLITE_OMIT_PROGRESS_CALLBACK=1',
    '-DSQLITE_OMIT_SHARED_CACHE=1',
    '-DSQLITE_TEMP_STORE=3',
    '-DSQLITE_THREADSAFE=0',
    '-DSQLITE_USE_ALLOCA=1'
  ],
  // optional features by name: the ones listed in enabled are built
  extensions: {
    column_metadata: ['-DSQLITE_ENABLE_COLUMN_METADATA=1'],
    fts5: ['-DSQLITE_ENABLE_FTS5=1'],
    math: ['-DSQLITE_ENABLE_MATH_FUNCTIONS=1'],
    normalize: ['-DSQLITE_ENABLE_NORMALIZE=1'],
    rtree: ['-DSQLITE_ENABLE_RTREE=1'],
    soundex: ['-DSQLITE_SOUNDEX=1'],
    stat4: ['-DSQLITE_ENABLE_STAT4=1'],
    update_delete_limit: ['-DSQLITE_ENABLE_UPDATE_DELETE_LIMIT=1']
  },
  enabled: [
    'column_metadata', 'fts5', 'math', 'normalize', 'rtree', 'soundex',
    'stat4', 'update_delete_limit'
  ]
}

export {
  api, includes, name, preamble, obj, libs, constants, include_paths, library
}
