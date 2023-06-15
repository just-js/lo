// https://github.com/facebook/rocksdb/wiki/Basic-Operations

import { run } from 'lib/bench.js'
import { system } from 'lib/system.js'

const { rocksdb } = spin.load('rocksdb')

const { assert, utf8Decode, readMemory } = spin

const handle = new Uint32Array(2)
const options_create = spin.wrap(handle, rocksdb.options_create, 0)
const readoptions_create = spin.wrap(handle, rocksdb.readoptions_create, 0)
const writeoptions_create = spin.wrap(handle, rocksdb.writeoptions_create, 0)
const open = spin.wrap(handle, rocksdb.open, 3)
const get = spin.wrap(handle, rocksdb.get, 6)

const dbopts = options_create()
assert(dbopts)
rocksdb.options_set_create_if_missing(dbopts, 1)
const db = open(dbopts, '/dev/shm/foo.db', handle)
assert(db)

const readopts = readoptions_create()
assert(readopts)
const writeopts = writeoptions_create()
assert(writeopts)

const pageSize = 4096
const page = new Uint8Array(pageSize)
const k = 'hello'
const v = '1'.repeat(pageSize)
const kb = 'hellobuffer'
const vb = page

rocksdb.put_string(db, writeopts, k, k.length, v, v.length, handle)
rocksdb.put(db, writeopts, kb, kb.length, vb, vb.length, handle)
const size = new Uint32Array(1)
const strptr = get(db, readopts, k, k.length, size, handle)
assert(utf8Decode(strptr, size[0]) === v)
const bufptr = get(db, readopts, kb, kb.length, size, handle)
assert(bufptr)
assert(size[0] === pageSize)

function getstring (key) {
  const strptr = get(db, readopts, key, key.length, size, handle)
  const str = utf8Decode(strptr, size[0])
  system.free(strptr)
  return str
}

function putstring (key, value) {
  rocksdb.put_string(db, writeopts, key, key.length, value, value.length, handle)
}

const u8 = new Uint8Array(vb.length)

function getbuffer (key) {
  const strptr = get(db, readopts, key, key.length, size, handle)
  readMemory(u8, strptr, u8.length)
  system.free(strptr)
  return u8
}

function putbuffer (key, value) {
  rocksdb.put(db, writeopts, key, key.length, value, value.length, handle)
}

assert(getstring(k) === v)
assert(getbuffer(kb).length === vb.length)

// 260k ops/sec for 1024 byte page size
run('put', () => putbuffer(kb, vb), 400000, 10)
// 2.8m ops/sec
//run('get', () => getbuffer(k), 4000000, 10)

// 226k ops/sec
//run('putstring', () => putstring(k, v), 400000, 10)
// 1.75m ops/sec
//run('getstring', () => getstring(k), 4000000, 10)

rocksdb.close(db)
