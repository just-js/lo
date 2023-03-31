import { dlopen, CString, ptr } from 'bun:ffi'
import { run } from '../../../lib/bench.js'

function open (path = ':memory:', flags = defaultFlags) {
  sqlite3_open_v2(ptr(encoder.encode(`${path}\0`)), ptr(pHandle), flags, 0)
  return pHandle[0] + 2 ** 32 * pHandle[1]
}

function execute (sql) {
  sqlite3_exec(db, ptr(encoder.encode(`${sql}\0`)), 0, 0, ptr(pHandle))
}

function prepare (sql) {
  const s = encoder.encode(sql)
  sqlite3_prepare_v2(db, ptr(s), s.byteLength, ptr(pHandle), 0)
  return pHandle[0] + 2 ** 32 * pHandle[1]
}

function get () {
  if (sqlite3_step(stmt) === ROW) {
    const v = sqlite3_column_int(stmt, 0)
    sqlite3_reset(stmt)
    return v
  }
  return -1
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
    sqlite3_libversion, sqlite3_open_v2, sqlite3_exec, sqlite3_prepare_v2, 
    sqlite3_reset, sqlite3_step, sqlite3_column_int
  }
} = dlopen('./libsqlite3.so', {
  sqlite3_libversion: {
    args: [],
    returns: 'ptr'
  },
  sqlite3_open_v2: {
    args: ['ptr', 'ptr', 'i32', 'u64'],
    returns: 'i32'
  },
  sqlite3_prepare_v2: {
    args: ['u64', 'ptr', 'i32', 'ptr', 'u64'],
    returns: 'i32'
  },
  sqlite3_exec: {
    args: ['u64', 'ptr', 'u64', 'u64', 'ptr'],
    returns: 'i32',
  },
  sqlite3_reset: {
    args: ['u64'],
    returns: 'i32',
  },
  sqlite3_step: {
    args: ['u64'],
    returns: 'i32',
  },
  sqlite3_column_int: {
    args: ['u64', 'i32'],
    returns: 'i32',
  }
})


const db = open()
execute('PRAGMA user_version = 100')
const stmt = prepare('pragma user_version')
console.log(get())
console.log(new CString(sqlite3_libversion()))

run('pragma user_version', get, 10000000, 20)
//run('sqlite3_version', () => new CString(sqlite3_libversion()), 30000000, 10)

//const p = sqlite3_libversion()
//console.log(p)
//console.log(new CString(p))
//run('cstring', () => new CString(p), 5000000, 10)