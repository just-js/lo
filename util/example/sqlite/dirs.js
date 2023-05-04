import { Database } from 'lib/sqlite.js'
import { join } from 'lib/path.js'

const { fs, readMemory, utf8Decode, assert, wrap } = spin
const { readFile } = spin.fs

const handle = new Uint32Array(2)
const opendir = wrap(handle, fs.opendir, 1)
const readdir = wrap(handle, fs.readdir, 1)

const u8 = new Uint8Array(19)
const view = new DataView(u8.buffer)

function readEntry (handle) {
  readMemory(u8, handle, 19)
  const d_ino = view.getUint32(0, true)
  const d_off = view.getUint32(8, true)
  const d_reclen = view.getUint16(16, true)
  const d_type = u8[18]
  const name = utf8Decode(handle + 19, -1)
  return { d_ino, d_off, d_reclen, d_type, name }
}

function readDir (path) {
  const dir = opendir(path)
  let next = readdir(dir)
  assert(next)
  const entries = []
  while (next) {
    entries.push(readEntry(next))
    next = readdir(dir)
  }
  assert(fs.closedir(dir) === 0)
  return entries
}

const db = (new Database()).open('blob.db')
db.exec('PRAGMA journal_mode = wal');
db.exec('PRAGMA auto_vacuum = none');
db.exec('PRAGMA temp_store = memory');
db.exec('PRAGMA locking_mode = exclusive');
db.exec('create table if not exists asset (path TEXT PRIMARY KEY, payload BLOB)')
const createAsset = db.prepare('insert or replace into asset (path, payload) values (@path, @payload)')
//const createAsset = db.prepare('insert or ignore into asset (path, payload) values (@path, @payload)')
// store a checksum/hash of the file so we can compare

const addPath = spin.args[2] || './lib'
const entries = readDir(addPath).filter(e => e.d_type === 8)

for (const entry of entries) {
  const path = join(addPath, entry.name)
  assert(createAsset.bindText(1, path) === 0)
  console.log(path)
  assert(createAsset.bindBlob(2, readFile(path)) === 0)
  assert(createAsset.step() === 101)
  assert(createAsset.reset() === 0)
}

assert(createAsset.finalize() === 0)
//console.error(`vacuum into '${cwd()}/new.db'`)
//db.exec(`vacuum into '${cwd()}/new.db'`)
db.exec('vacuum')
db.close()


// if we embed everything in the binary then we can overcommit memory and let the page cache do it's thing
