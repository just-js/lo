import { Database } from 'lib/sqlite.js'
import { run } from 'lib/bench.js'

const { assert } = spin
const { readFile } = spin.fs

const decoder = new TextDecoder()
const db = (new Database()).open(':memory:')
db.exec("PRAGMA auto_vacuum = none");
db.exec("PRAGMA temp_store = memory");
db.exec("PRAGMA locking_mode = exclusive");

db.exec('create table if not exists asset (path TEXT PRIMARY KEY, payload BLOB)')
const createAsset = db.prepare('insert or ignore into asset (path, payload) values (@path, @payload)')
assert(createAsset.bindText(1, 'main.h') === 0)
assert(createAsset.bindBlob(2, readFile('main.h')) === 0)
assert(createAsset.step() === 101)
const assets = db.prepare('select * from asset where path = @path').compile('Asset', true)
assets.types = [3, 4]
assert(assets.bindText(1, 'main.h') === 0)

const MAXFILESIZE = 65536
const u8 = new Uint8Array(MAXFILESIZE)

function getAsset (path) {
  assert(assets.bindText(1, path) === 0)
  assets.step()
  const buf = u8.subarray(0, assets.columnBlobInto(1, u8))
  assets.reset()
  return buf
}

function getAsset2 (path) {
  assert(assets.bindText(1, path) === 0)
  assets.step()
  const size = assets.columnBlobInto(1, u8)
  assets.reset()
  return size
}

function getAsset3 () {
  assets.step()
  const size = assets.columnBlobInto(1, u8)
  assets.reset()
  return size
}

console.log(decoder.decode(getAsset('main.h')).length)
console.log(getAsset2('main.h'))

//run('getAsset', () => getAsset('main.h'), 3000000, 100)
//run('getAsset2', () => getAsset2('main.h'), 3000000, 100)
run('getAsset3', getAsset3, 3000000, 100)

// TODO: https://sqlite.org/c3ref/blob_open.html
// we could keep a handle open for each file and serve segments of it
// the actual db could be stored in sqlite itself. lol
// and the wal could be written into the db


/*

LD_PRELOAD=./scratch/libsqlite3.so taskset --cpu-list 0 ./spin sqltest.js


we can retrieve 2m 1124 byte assets a second
that is 500 ns per asset
that is 17984000000 per second or 17.98 gigabits/second
*/

// TODO: https://nghttp2.org/documentation/apiref.html
// TODO: https://github.com/ngtcp2/nghttp3
// https://github.com/microsoft/msquic