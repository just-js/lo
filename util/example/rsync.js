const { rsync } = spin.load('rsync') 
const { fs, assert, getAddress } = spin

rsync.begin = spin.wrap(new Uint32Array(2), rsync.begin, 3)

class RsyncBuffer {
  constructor () {
    this.raw = new Uint8Array(8 + 8 + 8 + 8 + 8)
    this.view = new DataView(this.raw.buffer)
  }

  set nextIn (u8) {
    this.view.setBigUint64(0, BigInt(getAddress(u8)), true)
    this.view.setUint32(8, u8.length, true)
  }

  set availIn (len) {
    this.view.setUint32(8, len, true)
  }

  get availIn () {
    return this.view.getUint32(8, true)
  }

  set eof (v) {
    this.view.setUint32(16, v, true)
  }

  set nextOut (u8) {
    this.view.setBigUint64(24, BigInt(getAddress(u8)), true)
    this.view.setUint32(32, u8.length, true)
  }

  get availOut () {
    return this.view.getUint32(32, true)
  }

  set availOut (len) {
    this.view.setUint32(32, len, true)
  }
}

const RS_RK_BLAKE2_SIG_MAGIC = 0x72730147
const RS_MD4_SIG_MAGIC = 0x72730136
const RS_BLAKE2_SIG_MAGIC = 0x72730137
const RS_RK_MD4_SIG_MAGIC = 0x72730146

const RS_DONE = 0
const RS_BLOCKED = 1
const RS_RUNNING = 2
const RS_TEST_SKIPPED = 77
const RS_IO_ERROR = 100
const RS_SYNTAX_ERROR = 101
const RS_MEM_ERROR = 102
const RS_INPUT_ENDED = 103
const RS_BAD_MAGIC = 104
const RS_UNIMPLEMENTED = 105
const RS_CORRUPT = 106
const RS_INTERNAL_ERROR = 107
const RS_PARAM_ERROR = 108

// rdiff -b 1408 -S 16 signature scratch/libSDL2.so foo.sig
const bin = fs.readFile('./plstatz.db')
const bout = new Uint8Array(bin.length)
const buf = new RsyncBuffer()
const [ magic, block_len, strong_len ] = [new Uint32Array(1), new Uint32Array(2), new Uint32Array(2)]

const chunkSize = 65536

magic[0] = RS_MD4_SIG_MAGIC
block_len[0] = chunkSize
strong_len[0] = 0
assert(rsync.args(bin.length, magic, block_len, strong_len) === RS_DONE)
console.log(block_len)
console.log(strong_len)
assert(magic[0] === RS_MD4_SIG_MAGIC)
const handle = rsync.begin(block_len[0], strong_len[0], magic[0])
assert(handle)

buf.nextOut = bout
buf.nextIn = bin

const chunks = Math.ceil(bin.length / chunkSize)
for (let i = 0, off = 0; i < chunks; ++i, off += chunkSize) {
  const towrite = Math.min(bin.length - off, chunkSize)
  //buf.availIn = towrite
  buf.nextIn = bin.subarray(off, off + towrite)
  assert(rsync.iter(handle, buf.raw) === RS_BLOCKED)
  console.log(`write ${towrite} done ${bout.length - buf.availOut} ${buf.availIn}`)
}
buf.eof = 1
assert(rsync.iter(handle, buf.raw) === RS_DONE)
console.log(`done ${bout.length - buf.availOut}`)
assert(buf.availIn === 0)


fs.writeFile('./spin.sig', bout.subarray(0, bout.length - buf.availOut))
assert(rsync.free(handle) === RS_DONE)
