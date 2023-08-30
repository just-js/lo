import { run } from '../../../lib/bench.js'

const { dlopen, UnsafePointer } = Deno

function createPointer (handle) {
  return UnsafePointer.create(handle[0] + 2 ** 32 * handle[1])
}

function open (path = ':memory:', flags = defaultFlags) {
  sqlite3_open_v2(UnsafePointer.of(encoder.encode(`${path}\0`)), UnsafePointer.of(pHandle), flags, null)
  return createPointer(pHandle)
}

function exec (sql) {
  sqlite3_exec(db, UnsafePointer.of(encoder.encode(`${sql}\0`)), null, null, UnsafePointer.of(pHandle))
}

function prepare (sql) {
  const s = encoder.encode(sql)
  sqlite3_prepare_v2(db, UnsafePointer.of(s), s.byteLength, UnsafePointer.of(pHandle), null)
  return createPointer(pHandle)
}

function get () {
  if (sqlite3_step(stmt) === ROW) {
    const v = sqlite3_column_int(stmt, 0)
    sqlite3_reset(stmt)
    return v
  }
  return 0
}

const encoder = new TextEncoder()
const OPEN_CREATE = 0x00000004
const OPEN_READWRITE = 0x00000002
const OPEN_NOMUTEX = 0x00008000
const ROW = 100
const defaultFlags = OPEN_READWRITE | OPEN_CREATE | OPEN_NOMUTEX
const pHandle = new Uint32Array(2)

const {
  symbols: {
    sqlite3_open_v2, sqlite3_exec, sqlite3_prepare_v2, sqlite3_reset,
    sqlite3_step, sqlite3_column_int, sqlite3_libversion
  }
} = dlopen('./scratch/libsqlite3.so', {
  sqlite3_libversion: {
    parameters: [],
    result: 'pointer'
  },
  sqlite3_open_v2: {
    parameters: ['pointer', 'pointer', 'i32', 'pointer'], result: 'i32'
  },
  sqlite3_prepare_v2: {
    parameters: ['pointer', 'pointer', 'i32', 'pointer', 'pointer'],
    result: 'i32'
  },
  sqlite3_exec: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer', 'pointer'],
    result: 'i32'
  },
  sqlite3_step: {
    parameters: ['pointer'], result: 'i32'
  },
  sqlite3_column_int: {
    parameters: ['pointer', 'i32'], result: 'i32'
  },
  sqlite3_reset: {
    parameters: ['pointer'], result: 'i32'
  }
})

const db = open()
exec('PRAGMA user_version = 100')
const stmt = prepare('pragma user_version')
run('pragma user_version', get, 15000000, 10)
//run('sqlite3_version', () => (new Deno.UnsafePointerView(sqlite3_libversion())).getCString(), 30000000, 10)

//console.log((new Deno.UnsafePointerView(sqlite3_libversion())).getCString())