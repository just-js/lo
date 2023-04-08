import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'
import * as lz4 from 'bindings/lz4/lz4.js'

const { assert } = spin
const { readFile } = spin.fs

const LZ4HC_CLEVEL_MIN = 3
const LZ4HC_CLEVEL_DEFAULT = 9
const LZ4HC_CLEVEL_OPT_MIN = 10
const LZ4HC_CLEVEL_MAX = 12

const path = './scratch/liblz4.so'
const {
  LZ4_compress_default, LZ4_compress_HC
} = (new Library()).open(path).bind(lz4.api)

const src = readFile(path)
const dest = new Uint8Array(src.byteLength)

const normal = () => LZ4_compress_default(src, dest, src.byteLength, dest.byteLength)
const deflt = () => LZ4_compress_HC(src, dest, src.byteLength, dest.byteLength, LZ4HC_CLEVEL_DEFAULT)
const min = () => LZ4_compress_HC(src, dest, src.byteLength, dest.byteLength, LZ4HC_CLEVEL_MIN)
const optmin = () => LZ4_compress_HC(src, dest, src.byteLength, dest.byteLength, LZ4HC_CLEVEL_OPT_MIN)
const best = () => LZ4_compress_HC(src, dest, src.byteLength, dest.byteLength, LZ4HC_CLEVEL_MAX)

assert(normal() === 157307)
assert(deflt() === 125879)
assert(min() === 128368)
assert(optmin() === 125719)
assert(best() === 125544)

const repeat = 5

while (1) {
  console.log(`original ${src.byteLength} normal ${normal()}`)
  run('normal', normal, 3000, repeat)
  console.log(`original ${src.byteLength} min ${min()}`)
  run('min', min, 300, repeat)
  console.log(`original ${src.byteLength} default ${deflt()}`)
  run('deflt', deflt, 200, repeat)
  console.log(`original ${src.byteLength} optmin ${optmin()}`)
  run('optmin', optmin, 200, repeat)
  console.log(`original ${src.byteLength} best ${best()}`)
  run('best', best, 100, repeat)
}
