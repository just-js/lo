import { Bench } from '../lib/bench.js'
import { hash } from 'node:crypto'

const encoder = new TextEncoder()
const hello_str = 'hello\n'
const hello = encoder.encode(hello_str)

const expectedsha256 = [ 
  0x58, 0x91, 0xb5, 0xb5, 0x22, 0xd5, 0xdf, 0x08, 0x6d, 0x0f, 0xf0, 0xb1, 0x10, 0xfb, 0xd9, 0xd2,
  0x1b, 0xb4, 0xfc, 0x71, 0x63, 0xaf, 0x34, 0xd0, 0x82, 0x86, 0xa2, 0xe8, 0x46, 0xf6, 0xbe, 0x03
]

const expectedsha256_str= '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03'

function sha256_hash_buffer (buf) {
  return hash('sha256', buf, 'buffer')
}

function sha256_hash_string (str) {
  return hash('sha256', str)
}

// https://github.com/nodejs/performance/issues/136
// https://github.com/rdw-msft/node/commit/6bc5fee43812e0da4454ff0fc71db139e6452da5
// https://github.com/cloudflare/workerd/issues/1781
sha256_hash_buffer(hello).forEach((v, i) => assert(v === expectedsha256[i]))
assert(sha256_hash_string(hello_str) === expectedsha256_str)

const iter = parseInt(args[0] || '5', 10)
const runs = parseInt(args[1] || '1000000', 10)
let total = parseInt(args[2] || '1', 10)
const bench = new Bench()

while (total--) {
  for (let i = 0; i < iter; i++) {
    bench.start('sha256-buffer')
    for (let j = 0; j < runs; j++) {
      sha256_hash_buffer(hello)
    }
    bench.end(runs, hello.length)
  }

  for (let i = 0; i < iter; i++) {
    bench.start('sha256-string')
    for (let j = 0; j < runs; j++) {
      sha256_hash_string(hello_str)
    }
    bench.end(runs, hello.length)
  }
}
