import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'
import * as sqlite from 'bindings/sqlite/sqlite.js'

const { utf8Decode, utf8Length, assert } = spin

function open (path = ':memory:', flags = defaultFlags) {
  const rc = open2(path, pHandle, flags, 0)
  return spin.addr(pHandle)
}

function execute (sql) {
  exec(db, `${sql}\0`, 0, 0, pHandle)
}

function prepare (sql) {
  prepare2(db, sql, utf8Length(sql), pHandle, 0)
  return pHandle[0] + 2 ** 32 * pHandle[1]
}

function get () {
  if (step(stmt) === ROW) {
    const v = column_int(stmt, 0)
    reset(stmt)
    return v
  }
  return 0
}

const OPEN_CREATE = 0x00000004
const OPEN_READWRITE = 0x00000002
const OPEN_NOMUTEX = 0x00008000
const ROW = 100
const defaultFlags = OPEN_READWRITE | OPEN_NOMUTEX | OPEN_CREATE
const pHandle = new Uint32Array(2)

const path = 'libsqlite3.so'
const {
  version, open2, exec, prepare2, reset, column_int, step
} = (new Library()).open(path).bind(sqlite.api)


const db = open(':memory:')
assert(db)
execute('PRAGMA user_version = 100')
const stmt = prepare('pragma user_version')
assert(stmt)
assert(get() === 100)
console.log(utf8Decode(version(), -1))

run('pragma user_version', get, 15000000, 10)
//run('sqlite3_version', () => utf8Decode(version(), -1), 30000000, 10)
