import { Database } from 'lib/sqlite.js'
import { run } from 'lib/bench.js'

const { assert } = spin

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const db = (new Database()).open(':memory:')
db.exec("PRAGMA auto_vacuum = none");
db.exec("PRAGMA temp_store = memory");
db.exec("PRAGMA locking_mode = exclusive");
db.exec('CREATE TABLE IF NOT EXISTS entry (payload BLOB)')
const createAsset = db.prepare('INSERT OR IGNORE INTO entry (payload) values (@payload)')

const SIZE = 4096
const src = new Uint8Array(SIZE)

assert(createAsset.bindBlob(1, src) === 0, db.error)
assert(createAsset.step() === 101, db.error)
const blob = db.writableBlob('entry', 'payload', 1)
const size = blob.bytes()
assert(size > 0)
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
//run('blob.write', writeBlob, 300000, 10)

const { rows }  = db.prepare('select count(1) as rows from entry').get()
const { page_size } = db.prepare('pragma page_size').get()
const { page_count } = db.prepare('pragma page_count').get()
const dbSize = page_count * page_size
console.log(`rows ${rows} pages ${page_count} db ${dbSize}`)

blob.close()

