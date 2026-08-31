import { Bench } from 'lib/bench.js'

const { assert, load } = lo
const { foo } = load('foo')
const { noop } = foo
const bench = new Bench()
const iter = 5

while (1) {
  {
    const runs = 400000000

    for (let i = 0; i < iter; i++) {
      bench.start('foo.noop')
      for (let j = 0; j < runs; j++) assert(noop() === undefined)
      bench.end(runs)
    }
  }
}
