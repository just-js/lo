import { Bench } from 'lib/bench.js'
import { bind } from 'lib/ffi.js'

const { core, assert } = lo
const { dlopen, dlsym, RTLD_NOW, RTLD_LOCAL } = core
const handle = assert(dlopen('./lib/foo/foo.so', RTLD_NOW | RTLD_LOCAL))
const sym = assert(dlsym(handle, 'noop'))

const noop = bind(sym, 'void', [])

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
