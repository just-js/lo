const { core, load, ptr, assert } = lo
import { Bench } from 'lib/bench.js'

const { lz4 } = load('lz4')

const { compress_hc, decompress_safe } = lz4
const { read_file, open, read, O_RDONLY } = core

//const bytes = ptr(new Uint8Array(16 * 1024 * 1024))

const bytes = read_file('./zero-static')
const fd = open('/dev/urandom', O_RDONLY)
read(fd, bytes.ptr, bytes.length)

console.log(bytes.subarray(0, 16))


const cbytes = ptr(new Uint8Array(32 * 1024 * 1024))

const csize = compress_hc(bytes.ptr, cbytes.ptr, bytes.length, cbytes.length, 12)
console.log(csize)

const bench = new Bench()
const iter = 5
const runs = 1000

const dest = ptr(new Uint8Array(32 * 1024 * 1024))

assert(decompress_safe(cbytes.ptr, dest.ptr, csize, dest.length) === bytes.length)

for (let i = 0; i < iter; i++) {
  bench.start('decompress_safe')
  for (let j = 0; j < runs; j++) {
    assert(decompress_safe(cbytes.ptr, dest.ptr, csize, dest.length) === bytes.length)
  }
  bench.end(runs)
}

// 1.2ms overhead