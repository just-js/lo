const walHeaderSize = 32
const walFrameHeaderSize = 24

function calcCheck (u32, len = u32.length, off = 0, check = new Uint32Array(2)) {
  for (let i = 0; i < len; i += 2) {
    check[0] += u32[i + off] + check[1]
    check[1] += u32[i + off + 1] + check[0]
  }
  return check
}

class Bitmap {
  #cols = 8
  #shift = 3
  #rows = 0
  #bin

  constructor (size = 512) {
    this.capacity = size
    this.#rows = (size >> this.#shift) + 1
    this.#bin = new Uint8Array(this.#rows)
  }

  test (off) {
    return (this.#bin[off >> this.#shift] & (1 << (off % this.#cols))) > 0
  }

  set (off) {
    this.#bin[off >> this.#shift] |= (1 << (off % this.#cols))
  }

  reset (off) {
    this.#bin[off >> this.#shift] &= (255 ^ (1 << (off % this.#cols)))
  }

  fill (v = 0) {
    this.#bin.fill(v)
  }

  seek (from, pages = 8) {
    for (let i = 0; i < pages; i++) {
      if (this.test(from + i)) return i
    }
    return pages
  }
}

class MemoryFile {
  constructor () {
    this.size = 0
    this.mode = 0
    this.fileName = ''
  }

  open (fileName, u8) {
    this.fileName = fileName
    this.size = u8.byteLength
    this.view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
    this.u8 = u8
    return this
  }

  read (len = this.size, off = 0) {
    return this.u8.subarray(off, off + len)
  }

  write (u8, off = 0) {
    return this.u8.set(u8, off)
  }
}

class Frame {
  constructor (view, offset, pageSize) {
    this.view = view
    this.offset = offset
    this.pageSize = pageSize
    this.pageOffset = offset + walFrameHeaderSize
  }

  get page () {
    return this.view.getUint32(this.offset)
  }

  get totalPages () {
    return this.view.getUint32(this.offset + 4)
  }

  get salt () {
    const { view, offset } = this
    return [view.getUint32(offset + 8), view.getUint32(offset + 12)]
  }

  get checksum () {
    const { view, offset } = this
    return [view.getUint32(offset + 16), view.getUint32(offset + 20)]
  }

  get pageData () {
    return this.view.buffer.slice(this.pageOffset, this.pageOffset + this.pageSize)
  }
}

class Wal extends MemoryFile {
  constructor () {
    super()
    this.offset = 0
  }

  get magic () {
    return this.view.getUint32(0)
  }

  get formatVersion () {
    return this.view.getUint32(4)
  }

  get pageSize () {
    return this.view.getUint32(8)
  }

  get checkpointSequence () {
    return this.view.getUint32(12)
  }

  get salt () {
    const { view } = this
    return [view.getUint32(16), view.getUint32(20)]
  }

  get checksum () {
    const { view } = this
    return new Uint32Array([view.getUint32(24), view.getUint32(28)])
  }

  readFrames (end, start = 0) {
    const { view, pageSize } = this
    let offset = walHeaderSize
    const frames = []
    for (let i = start; i < end; i++) {
      const frame = new Frame(view, offset, pageSize)
      offset += (pageSize + walFrameHeaderSize)
      frames.push(frame)
    }
    return frames
  }

  consolidate (frames) {
    const memo = new Map()
    const log = []
    for (const frame of frames) {
      const { page } = frame
      if (!memo.has(page)) memo.set(page, log.length)
      log[memo.get(page)] = frame
    }
    return log
  }

  serialize (frames) {
    const size = walHeaderSize + ((walFrameHeaderSize + this.pageSize) * frames.length)
    const buf = new ArrayBuffer(size)
    const u32 = new Uint32Array(buf)
    const view = new DataView(buf)
    const u8 = new Uint8Array(buf)
    u8.set(this.u8.slice(0, walHeaderSize), 0)
    let offset = walHeaderSize
    const { checksum } = this
    for (const frame of frames) {
      u8.set(this.u8.slice(frame.pageOffset - walFrameHeaderSize, frame.pageOffset + this.pageSize), offset)
      const intOffset = Math.floor(offset / 4)
      calcCheck(u32, 2, intOffset, checksum)
      calcCheck(u32, Math.floor(this.pageSize / 4), intOffset + Math.floor(walFrameHeaderSize / 4), checksum)
      view.setUint32(offset + 16, checksum[0])
      view.setUint32(offset + 20, checksum[1])
      offset += this.pageSize + walFrameHeaderSize
    }
    return u8
  }
}

class WalIndex extends MemoryFile {
  constructor () {
    super()
    this.LE = true
  }

  get version () {
    return this.view.getUint32(0, this.LE)
  }

  get padding () {
    return this.view.getUint32(4, this.LE)
  }

  get counter () {
    return this.view.getUint32(8, this.LE)
  }

  get initialized () {
    return this.view.getUint8(12)
  }

  get bigEndianChecksum () {
    return this.view.getUint8(13)
  }

  get pageSize () {
    return this.view.getUint16(14, this.LE)
  }

  get mxFrame () {
    return this.view.getUint32(16, this.LE)
  }

  get nPage () {
    return this.view.getUint32(20, this.LE)
  }

  get frameCheck () {
    const { view, LE } = this
    return [view.getUint32(24, LE), view.getUint32(28, LE)]
  }

  get salt () {
    const { view, LE } = this
    return [view.getUint32(32, LE), view.getUint32(36, LE)]
  }

  get checksum () {
    const { view, LE } = this
    return [view.getUint32(40, LE), view.getUint32(44, LE)]
  }

  get backfill () {
    return this.view.getUint32(96, this.LE)
  }

  get backfillAttempt () {
    return this.view.getUint32(128, this.LE)
  }

  get locks () {
    return this.u8.subarray(120, 128)
  }

  dirty () {
    this.view.setUint32(16, 1, this.LE)
    this.view.setUint32(64, 0, this.LE)
  }
}

/*
const walb = spin.fs.readFile('blob.db-wal')
console.log(walb.length)
const wal = new Wal()
wal.open('blob.db-wal', walb)
console.log(wal.magic)
console.log(wal.formatVersion)
console.log(wal.pageSize)
console.log(wal.checkpointSequence)
console.log(wal.salt)
console.log(wal.checksum)

const indexb = spin.fs.readFile('blob.db-shm')
console.log(indexb.length)
const walIndex = new WalIndex()
walIndex.open('blob.db-shm', indexb)

console.log(walIndex.version)
console.log(walIndex.padding)
console.log(walIndex.counter)
console.log(walIndex.initialized)
console.log(walIndex.bigEndianChecksum)
console.log(walIndex.pageSize)
console.log(walIndex.mxFrame)
console.log(walIndex.nPage)
console.log(walIndex.frameCheck)
console.log(walIndex.salt)
console.log(walIndex.checksum)
console.log(walIndex.backfill)
console.log(walIndex.backfillAttempt)
console.log(walIndex.locks)

const frames = wal.readFrames(walIndex.mxFrame)
console.log(frames.length)
console.log(wal.consolidate(frames).length)

const buf = wal.serialize(wal.consolidate(frames))
console.log(buf.length)
console.log(wal.consolidate(frames).map(f => f.page).sort((a, b) => a - b))
*/

class Database extends MemoryFile {
  constructor () {
    super()
    this.LE = false
  }

  get header () {
    return decoder.decode(this.u8.subarray(0, 16), -1)
  }

  get pageSize () {
    return this.view.getUint16(16, this.LE)
  }

  get fileFormatVersions () {
    return this.u8.subarray(18, 20)
  }

  get reservedSpace () {
    return this.u8[20]
  }

  get embeddedPayloadLimits () {
    return this.u8.subarray(21, 23)
  }

  get leafPayloadFraction () {
    return this.u8[23]
  }

  get fileChangeCounter () {
    return this.view.getUint32(24, this.LE)
  }

  get pages () {
    return this.view.getUint32(28, this.LE)
  }

  get freeListTrunkPage () {
    return this.view.getUint32(32, this.LE)
  }

  get freeListPages () {
    return this.view.getUint32(36, this.LE)
  }

  get schemaCookie () {
    return this.view.getUint32(40, this.LE)
  }

  get schemaFormat () {
    return this.view.getUint32(44, this.LE)
  }

  get defaultPageCacheSize () {
    return this.view.getUint32(48, this.LE)
  }

  get largestRootBTreePage () {
    return this.view.getUint32(52, this.LE)
  }

  get textEncoding () {
    return this.view.getUint32(56, this.LE)
  }

  get userVersion () {
    return this.view.getUint32(60, this.LE)
  }

  get incrementalVacuum () {
    return this.view.getUint32(64, this.LE)
  }

  get applicationId () {
    return this.view.getUint32(68, this.LE)
  }

  get versionValidFor () {
    return this.view.getUint32(92, this.LE)
  }

  get versionNumber () {
    return this.view.getUint32(96, this.LE)
  }
}

const dbb = spin.fs.readFile('blob.db')
const decoder = new TextDecoder()
const db = new Database()
db.open('blob.db', dbb)
console.log(`header ${db.header}`)
console.log(`pageSize ${db.pageSize}`)
console.log(`fileFormatVersions ${db.fileFormatVersions}`)
console.log(`reservedSpace ${db.reservedSpace}`)
console.log(`embeddedPayloadLimits ${db.embeddedPayloadLimits}`)
console.log(`leafPayloadFraction ${db.leafPayloadFraction}`)
console.log(`fileChangeCounter ${db.fileChangeCounter}`)
console.log(`pages ${db.pages}`)
console.log(`freeListTrunkPage ${db.freeListTrunkPage}`)
console.log(`freeListPages ${db.freeListPages}`)
console.log(`schemaCookie ${db.schemaCookie}`)
console.log(`schemaFormat ${db.schemaFormat}`)
console.log(`defaultPageCacheSize ${db.defaultPageCacheSize}`)
console.log(`largestRootBTreePage ${db.largestRootBTreePage}`)
console.log(`textEncoding ${db.textEncoding}`)
console.log(`userVersion ${db.userVersion}`)
console.log(`incrementalVacuum ${db.incrementalVacuum}`)
console.log(`applicationId ${db.applicationId}`)
console.log(`versionValidFor ${db.versionValidFor}`)
console.log(`versionNumber ${db.versionNumber}`)


const BTREE_INT_IDX = 0x02
const BTREE_INT_TBL = 0x05
const BTREE_LEAF_IDX = 0x0a
const BTREE_LEAF_TBL = 0x0d

let off = 0
for (let i = 0; i < db.pages; i++) {
  if (i === 0) off += 100
  console.log(`page ${i}`)
  const pageType = dbb[off]
  console.log(`pageType ${pageType}`)
  const firstFreeBlock = (dbb[off + 1] * 256) + dbb[off + 2]
  console.log(`firstFreeBlock ${firstFreeBlock}`)
  const numCells = (dbb[off + 3] * 256) + dbb[off + 4]
  console.log(`numCells ${numCells}`)
  const cellContentStart = (dbb[off + 5] * 256) + dbb[off + 6]
  console.log(`cellContentStart ${cellContentStart}`)
  const fragmentedFree = dbb[off + 7]
  console.log(`fragmentedFree ${fragmentedFree}`)
  off += db.pageSize
  if (i === 0) off -= 100
}


//spin.fs.writeFile('./blob.new.db', buf)