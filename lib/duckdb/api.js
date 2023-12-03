const api = {
  create_config: {
    parameters: ['pointer'],
    pointers: ['duckdb_config*'],
    result: 'i32',
    name: 'duckdb_create_config'
  },
  open_ext: {
    parameters: ['string', 'u32array', 'pointer', 'pointer'],
    pointers: ['const char*', 'duckdb_database*', 'duckdb_config', 'char**'],
    result: 'i32',
    name: 'duckdb_open_ext'
  },
  set_config: {
    parameters: ['pointer', 'string', 'string'],
    pointers: ['duckdb_config*'],
    result: 'i32'
  },
  connect: {
    parameters: ['pointer', 'u32array'],
    pointers: ['duckdb_database', 'duckdb_connection*'],
    result: 'i32',
    name: 'duckdb_connect'
  },
  query: {
    parameters: ['pointer', 'string', 'pointer'],
    pointers: ['duckdb_connection', , 'duckdb_result*'],
    result: 'i32',
    name: 'duckdb_query'
  },
  prepare: {
    parameters: ['pointer', 'string', 'u32array'],
    pointers: ['duckdb_connection', , 'duckdb_prepared_statement*'],
    result: 'i32',
    name: 'duckdb_prepare'
  },
  row_count: {
    parameters: ['pointer'],
    pointers: ['duckdb_result*'],
    result: 'i32',
    name: 'duckdb_row_count'
  },
  column_count: {
    parameters: ['pointer'],
    pointers: ['duckdb_result*'],
    result: 'i32',
    name: 'duckdb_column_count'
  },
  value_timestamp: {
    parameters: ['pointer', 'u32', 'u32'],
    pointers: ['duckdb_result*'],
    rpointer: 'duckdb_timestamp',
    result: 'pointer',
    name: 'duckdb_value_timestamp'
  },
  value_uint32: {
    parameters: ['pointer', 'u32', 'u32'],
    pointers: ['duckdb_result*'],
    result: 'u32',
    name: 'duckdb_value_uint32'
  },
  value_int32: {
    parameters: ['pointer', 'u32', 'u32'],
    pointers: ['duckdb_result*'],
    result: 'i32',
    name: 'duckdb_value_int32'
  },
  value_varchar: {
    // todo: these should be u64
    parameters: ['pointer', 'u32', 'u32'],
    pointers: ['duckdb_result*'],
    result: 'pointer',
    rpointer: 'char*',
    name: 'duckdb_value_varchar'
  },
  close: {
    parameters: ['pointer'],
    pointers: ['duckdb_database*'],
    result: 'void',
    name: 'duckdb_close'
  },
  destroy_result: {
    // todo: these should be u64
    parameters: ['pointer'],
    pointers: ['duckdb_result*'],
    result: 'void',
    name: 'duckdb_destroy_result'
  },
  destroy_prepare: {
    // todo: these should be u64
    parameters: ['pointer'],
    pointers: ['duckdb_prepared_statement*'],
    result: 'void',
    name: 'duckdb_destroy_prepare'
  },
  execute_prepared: {
    parameters: ['pointer', 'pointer'],
    pointers: ['duckdb_prepared_statement', 'duckdb_result*'],
    result: 'i32',
    name: 'duckdb_execute_prepared'
  },
  column_name: {
    // todo: these should be u64
    parameters: ['pointer', 'u32'],
    pointers: ['duckdb_result*'],
    result: 'pointer',
    rpointer: 'const char*',
    name: 'duckdb_column_name'
  },
  column_type: {
    parameters: ['pointer', 'u32'],
    pointers: ['duckdb_result*'],
    result: 'i32',
    name: 'duckdb_column_type'
  },
  result_error: {
    parameters: ['pointer'],
    pointers: ['duckdb_result*'],
    result: 'pointer',
    rpointer: 'const char*',
    name: 'duckdb_result_error'
  },
  value_is_null: {
    parameters: ['pointer', 'u32', 'u32'],
    pointers: ['duckdb_result*'],
    result: 'u32',
    name: 'duckdb_value_is_null'
  },
  disconnect: {
    parameters: ['pointer'],
    pointers: ['duckdb_connection*'],
    result: 'void',
    name: 'duckdb_disconnect'
  },
  library_version: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const char*',
    name: 'duckdb_library_version'
  }
}

const name = 'duckdb'

const structs = [
  'duckdb_config', 'duckdb_result', 'duckdb_connection', 'duckdb_database',
  'duckdb_prepared_statement'
]

const obj = [
  'deps/duckdb/duckdb.o', 'duckdb.a'
]

const constants = {
  DuckDBSuccess: 'i32', DuckDBError: 'i32'
}
const include_paths = ['./deps/duckdb/src/include']
const includes = [
  'duckdb.h'
]

const preamble = `
int set_config (duckdb_config* config, const char* key, const char* value) {
  return duckdb_set_config(*config, key, value);
}
`

import { isDir, isFile } from 'lib/fs.js'
import { exec } from 'lib/proc.js'

async function build (C = 'gcc', CC = 'g++') {
  const { assert } = lo
  const { chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH } = lo.core
  const status = new Int32Array(2)

  if (!isDir('deps/duckdb')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    exec('git', ['clone', '--depth', '1', '--single-branch', '-b', 'v0.9.2', 'https://github.com/duckdb/duckdb.git'], status)
    assert(status[0] === 0)
    assert(chdir('../') === 0)
  }

  if (obj.some(o => !isFile(o))) {
    assert(chdir('deps/duckdb') === 0)
    exec('python3', ['scripts/amalgamation.py'], status)
    exec(CC.split(' ')[0], [...CC.split(' ').slice(1), '-fPIC', '-c', '-O3', '-o', 'duckdb.o', '-Isrc/amalgamation', 'src/amalgamation/duckdb.cpp'], status)
    assert(status[0] === 0)
    assert(chdir('../../') === 0)
  }

}

export { name, api, constants, structs, obj, build, include_paths, includes, preamble }
