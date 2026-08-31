import { Bench } from 'lib/bench.js'

const { assert, load, ptr } = lo
const { foo } = load('foo')
const { noop, add1, add1_i64, sum_buffer, str_len } = foo
const { noop_slow, add1_slow, sum_buffer_slow, str_len_slow } = foo
const bench = new Bench()
const iter = 5

const buf = ptr(new Uint8Array([1, 2, 3, 4, 5]))

assert(noop() === undefined)
assert(add1(1) === 2)

while (1) {

  {
    const runs = 400000000

    for (let i = 0; i < iter; i++) {
      bench.start('noop')
      for (let j = 0; j < runs; j++) assert(noop() === undefined)
      bench.end(runs)
    }
  }

  {
    const runs = 400000000

    for (let i = 0; i < iter; i++) {
      bench.start('add1')
      for (let j = 0; j < runs; j++) assert(add1(1) === 2)
      bench.end(runs)
    }
  }

  {
    const runs = 40000000

    for (let i = 0; i < iter; i++) {
      bench.start('add1_i64')
      for (let j = 0; j < runs; j++) assert(add1_i64(1n) === 2n)
      bench.end(runs)
    }
  }

  {
    const runs = 200000000

    for (let i = 0; i < iter; i++) {
      bench.start('sum_buffer')
      for (let j = 0; j < runs; j++) assert(sum_buffer(buf.ptr, 5) === 15)
      bench.end(runs)
    }
  }

  {
    const runs = 10000000

    for (let i = 0; i < iter; i++) {
      bench.start('str_len')
      for (let j = 0; j < runs; j++) assert(str_len('hello world') === 11)
      bench.end(runs)
    }
  }

  {
    const runs = 100000000

    for (let i = 0; i < iter; i++) {
      bench.start('noop_slow')
      for (let j = 0; j < runs; j++) assert(noop_slow() === undefined)
      bench.end(runs)
    }
  }

  {
    const runs = 100000000

    for (let i = 0; i < iter; i++) {
      bench.start('add1_slow')
      for (let j = 0; j < runs; j++) assert(add1_slow(1) === 2)
      bench.end(runs)
    }
  }

  {
    const runs = 50000000

    for (let i = 0; i < iter; i++) {
      bench.start('sum_buffer_slow')
      for (let j = 0; j < runs; j++) assert(sum_buffer_slow(buf.ptr, 5) === 15)
      bench.end(runs)
    }
  }

  {
    const runs = 3000000

    for (let i = 0; i < iter; i++) {
      bench.start('str_len_slow')
      for (let j = 0; j < runs; j++) assert(str_len_slow('hello world') === 11)
      bench.end(runs)
    }
  }

}
