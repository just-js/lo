import { Bench } from 'lib/bench.js'

const { assert, latin1_encode, latin1_decode, get_address } = lo

function ptr (u8) {
  if (u8.ptr) return u8.ptr
  u8.ptr = get_address(u8)
  return u8.ptr
}

const iter = 5
const runs = 30000000

const input = 'hello'
const buf = latin1_encode(input)
const size = buf.length
const bench = new Bench()

assert(latin1_decode(ptr(buf), size) === input)

while (1) {

  {
    for (let i = 0; i < iter; i++) {
      bench.start(`buf.ptr`)
      for (let j = 0; j < runs; j++) {
        assert(latin1_decode(buf.ptr, size) === input)
      }
      bench.end(runs, size)
    }
  }

  {
    for (let i = 0; i < iter; i++) {
      bench.start(`ptr(buf)`)
      for (let j = 0; j < runs; j++) {
        assert(latin1_decode(ptr(buf), size) === input)
      }
      bench.end(runs, size)
    }
  }

}