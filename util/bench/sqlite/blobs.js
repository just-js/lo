import { Database, sqlite } from 'lib/sqlite.js'
import { run } from 'lib/bench.js'

const { assert } = spin

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const db = (new Database()).open('blobs.db')
db.exec("PRAGMA auto_vacuum = none");
db.exec("PRAGMA temp_store = memory");
db.exec("PRAGMA locking_mode = exclusive");
db.exec('CREATE TABLE IF NOT EXISTS entry (key TEXT PRIMARY KEY, payload BLOB)')
const createAsset = db.prepare('INSERT OR IGNORE INTO entry (key, payload) values (@key, @payload)')

const SIZE = 4096
const src = new Uint8Array(SIZE)
const key = 'hellobuffer'

assert(createAsset.bindText(1, key) === 0, db.error)
assert(createAsset.bindBlob(2, src) === 0, db.error)
assert(createAsset.step() === 101, db.error)

const blob = db.writableBlob('entry', 'payload', 1)
const size = blob.bytes()
assert(size === SIZE)
const u8 = new Uint8Array(size)
blob.read(u8, size)
assert(decoder.decode(u8).length === size)

const errorHandler = () => db.error()

function writeBlob () {
  assert(createAsset.reset() === 0)
  assert(createAsset.bindBlob(1, src) === 0, errorHandler)
  assert(createAsset.step() === 101, errorHandler)
}

run('blob.read', () => blob.read(u8, size), 30000000, 10)
//run('blob.write', () => blob.write(u8, size), 30000000, 3)
//run('blob.write', writeBlob, 300000, 10)

const { rows }  = db.prepare('select count(1) as rows from entry').get()
const { page_size } = db.prepare('pragma page_size').get()
const { page_count } = db.prepare('pragma page_count').get()
const dbSize = page_count * page_size
console.log(`rows ${rows} pages ${page_count} db ${dbSize}`)

/*
const szu32 = new Uint32Array(2)
const ptru32 = new Uint32Array(2)
const serialize = spin.wrap(ptru32, sqlite.serialize, 4)
const address = serialize(db.db, 'main', szu32, 0)
const dbbytes = new Uint8Array(spin.wrapMemory(address, spin.addr(szu32), 1))
spin.fs.writeFile('./foo.db', dbbytes)
*/

blob.close()
db.close()
