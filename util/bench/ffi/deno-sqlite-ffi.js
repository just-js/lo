import { run } from '../../../lib/bench.js'

const { dlopen, UnsafePointer, UnsafeCallback } = Deno

const OPEN_CREATE = 0x00000004
const OPEN_READWRITE = 0x00000002
const OPEN_NOMUTEX = 0x00008000
const ROW = 100
const OK = 0
const defaultFlags = OPEN_READWRITE | OPEN_CREATE | OPEN_NOMUTEX
const pHandle = new Uint32Array(2)

function assert (condition, message, ErrorType = Error) {
  if (!condition) {
    throw new ErrorType(message || "Assertion failed")
  }
}

const sqlite = dlopen('libsqlite3.so', {
  sqlite3_open_v2: {
    parameters: ['pointer', 'pointer', 'i32', 'pointer'], result: 'i32'
  },
  sqlite3_exec: {
    parameters: ['pointer', 'pointer', 'function', 'pointer', 'pointer'],
    result: 'i32',
    callback: true
  },
  sqlite3_exec2: {
    parameters: ['pointer', 'pointer', 'function', 'pointer', 'pointer'],
    result: 'i32',
    name: 'sqlite3_exec'
  },
})

const callback = new UnsafeCallback({
  parameters: ['pointer', 'i32', 'pointer', 'pointer'],
  result: 'i32'
}, (ctx, cols, valuesPtr, namesPtr) => {
  //assert(ctx === null)
  assert(cols === 1)
})

const { sqlite3_open_v2, sqlite3_exec, sqlite3_exec2 } = sqlite.symbols

function createPointer (handle) {
  return UnsafePointer.create(handle[0] + 2 ** 32 * handle[1])
}

function open (path = ':memory:', flags = defaultFlags) {
  sqlite3_open_v2(UnsafePointer.of(encoder.encode(`${path}\0`)), 
    UnsafePointer.of(pHandle), flags, null)
  const ptr = createPointer(pHandle)
  assert(ptr)
  return ptr
}

function exec (db, sql, cbptr) {
  assert(sqlite3_exec(db, sql, cbptr, null, handlePtr) === OK)
}

function exec_fast (db, sql, cbptr) {
  assert(sqlite3_exec2(db, sql, null, null, handlePtr) === OK)
}

const encoder = new TextEncoder()
const sql = 'pragma user_version'
const handlePtr = UnsafePointer.of(pHandle)
const sqlptr = UnsafePointer.of(encoder.encode(`${sql}\0`))
const db = open()
exec(db, sqlptr, callback.pointer)

//run('user_version_no_callback', () => exec_fast(db, sqlptr, null), 3000000, 10)
run('user_version_callback', () => exec(db, sqlptr, callback.pointer), 3000000, 10)

// 1.678m ops/sec for no callback exec
// exec with callback crashes due to fastcall
