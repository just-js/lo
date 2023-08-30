import { run } from 'lib/bench.js'
import { bind, fastcall } from 'lib/fast.js'
import * as sqlite from 'bindings/sqlite/sqlite.js'

const { utf8Decode, utf8Length, assert, dlopen, dlsym, wrap, addr } = spin

function open (path = ':memory:', flags = defaultFlags) {
  const rc = open2(path, pHandle, flags, 0)
  assert(rc === 0)
  return addr(pHandle)
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
const path = './scratch/libsqlite3.so'
const handle = dlopen(path, 1)
assert(handle)
const binding = {}
Object.keys(sqlite.api).forEach(k => {
  const def = sqlite.api[k]
  const sym = dlsym(handle, def.name || k)
  assert(sym)
  const fn = bind(sym, def.result, def.parameters)
  if (def.result === 'pointer') {
    binding[k] = wrap(pHandle, fn, def.parameters.length)
  } else {
    binding[k] = fn
  }
})

const {
  version, open2, exec, prepare2, reset, column_int, step
} = binding

const db = open(':memory:')
assert(db)
execute('PRAGMA user_version = 100')
const stmt = prepare('pragma user_version')
assert(stmt)
assert(get() === 100)
console.log(utf8Decode(version(), -1))

run('pragma user_version', get, 15000000, 10)
//run('sqlite3_version', () => utf8Decode(version(), -1), 30000000, 10)
