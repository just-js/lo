import { Database, sqlite } from 'lib/sqlite.js'

const { assert, addr } = spin
const { readFile } = spin.fs

const db = (new Database()).open(':memory:')

db.exec("PRAGMA auto_vacuum = none");
db.exec("PRAGMA temp_store = memory");
db.exec("PRAGMA locking_mode = exclusive");

db.exec('create table if not exists asset (path TEXT PRIMARY KEY, payload BLOB)')
const createAsset = db.prepare('insert or ignore into asset (path, payload) values (@path, @payload)')
assert(createAsset.bindText(1, 'main.h') === 0)
assert(createAsset.bindBlob(2, readFile('main.h')) === 0)
assert(createAsset.step() === 101)

const handle = new Uint32Array(2)
assert(sqlite.blob_open(db.db, 'main', 'asset', 'payload', 1, 1, handle) === 0)
const bh = addr(handle)
assert(bh)

const size = sqlite.blob_bytes(bh)
assert(size > 0)
const u8 = new Uint8Array(size)
assert(sqlite.blob_read(bh, u8, size, 0) === 0)
const decoder = new TextDecoder()
console.log(decoder.decode(u8))

const encoder = new TextEncoder()
const u82 = encoder.encode('hello')
assert(sqlite.blob_write(bh, u82, u82.length, 0) === 0)

const size2 = sqlite.blob_bytes(bh)
assert(size2 > 0)
const u83 = new Uint8Array(size2)
assert(sqlite.blob_read(bh, u83, size2, 0) === 0)
console.log(decoder.decode(u83))

assert(sqlite.blob_close(bh) === 0)