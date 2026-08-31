import { Bench } from 'lib/bench.js'

const { assert, load } = lo
const { foo_abi } = load('foo_abi')
const { noop, add1 } = foo_abi
const bench = new Bench()
const iter = 5

assert(noop() === undefined)
assert(add1(1) === 2)

while (1) {
  {
    const runs = 400000000

    for (let i = 0; i < iter; i++) {
      bench.start('foo_abi.noop')
      for (let j = 0; j < runs; j++) assert(noop() === undefined)
      bench.end(runs)
    }
  }

  {
    const runs = 400000000

    for (let i = 0; i < iter; i++) {
      bench.start('foo_abi.add1')
      for (let j = 0; j < runs; j++) assert(add1(1) === 2)
      bench.end(runs)
    }
  }

}
