// https://github.com/facebook/rocksdb/wiki/Basic-Operations

import { run } from 'lib/bench.js'
import { system } from 'lib/system.js'

const { rocksdb } = spin.load('rocksdb')

const { assert, utf8Decode } = spin

const handle = new Uint32Array(2)
const options_create = spin.wrap(handle, rocksdb.options_create, 0)
const readoptions_create = spin.wrap(handle, rocksdb.readoptions_create, 0)
const writeoptions_create = spin.wrap(handle, rocksdb.writeoptions_create, 0)
const open = spin.wrap(handle, rocksdb.open, 3)
const get = spin.wrap(handle, rocksdb.get, 6)

const dbopts = options_create()
assert(dbopts)
rocksdb.options_set_create_if_missing(dbopts, 1)
const db = open(dbopts, 'foo.db', handle)
assert(db)

const readopts = readoptions_create()
assert(readopts)
const writeopts = writeoptions_create()
assert(writeopts)

rocksdb.put_string(db, writeopts, 'hello', 5, '123456789', 9, handle)
const size = new Uint32Array(1)
const strptr = get(db, readopts, 'hello', 5, size, handle)
assert(utf8Decode(strptr, size[0]) === '123456789')

function getstring (key) {
  const strptr = get(db, readopts, key, 5, size, handle)
  const str = utf8Decode(strptr, size[0])
  system.free(strptr)
  return str
}

function putstring (key, value) {
  rocksdb.put_string(db, writeopts, key, key.length, value, value.length, handle)
}

const k = 'hello'
const v = '123456789'

assert(getstring(k) === '123456789')

//run('put', () => putstring(k, v), 400000, 10)
run('get', () => getstring(k), 4000000, 10)

rocksdb.close(db)
