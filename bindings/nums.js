import { Bench } from 'lib/bench.js'
import { bind } from 'lib/ffi.js'

const { assert, core } = lo
const { dlopen, dlsym, RTLD_NOW, RTLD_LOCAL } = core

const handle = assert(dlopen('./nums.so', RTLD_NOW | RTLD_LOCAL))
const get_uint32 = bind(assert(dlsym(handle, 'get_uint32')), 'u32', ['u32'])

const bench = new Bench()

const runs = 300000000
const iter = 5

console.log(get_uint32(1))

for (let i = 0; i < iter; i++) {
  bench.start('get_uint32')
  for (let j = 0; j < runs; j++) {
    assert(get_uint32(j) === j)
  }
  bench.end(runs)
}