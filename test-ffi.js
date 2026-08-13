import { Bench } from 'lib/bench.js'
import { generate_callback, bind } from 'lib/ffi.js'

const { assert, core } = lo
const { dlopen, dlsym, RTLD_NOW, RTLD_LOCAL } = core

// gcc -fPIC -o cb.so -shared cb.c

const handle = assert(dlopen('./sum.so', RTLD_NOW | RTLD_LOCAL))
const test = bind(assert(dlsym(handle, 'test')), 'u32', ['pointer'])
const sum = bind(assert(dlsym(handle, 'sum')), 'i32', ['i32', 'i32'])
const test_slow = bind(assert(dlsym(handle, 'test')), 'u32', ['pointer'], true)
const sum_slow = bind(assert(dlsym(handle, 'sum')), 'i32', ['i32', 'i32'], true)

function on_event (counter) {
  return counter + 1
}

const bench = new Bench()
const iter = 5

{
  const runs = 1000000000

  for (let i = 0; i < iter; i++) {
    bench.start('sum_ffi')
    for (let j = 0; j < runs; j++) assert(sum(10, 20) === 30)
    bench.end(runs)
  }
}

{
  const runs = 150000000

  for (let i = 0; i < iter; i++) {
    bench.start('sum_ffi_slow')
    for (let j = 0; j < runs; j++) assert(sum_slow(10, 20) === 30)
    bench.end(runs)
  }
}
