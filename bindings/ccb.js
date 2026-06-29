import { Bench } from 'lib/bench.js'
import { generate_callback, bind } from 'lib/ffi.js'

const { assert, core } = lo
const { dlopen, dlsym, RTLD_NOW, RTLD_LOCAL } = core

// gcc -fPIC -o cb.so -shared cb.c

const handle = assert(dlopen('./cb.so', RTLD_NOW | RTLD_LOCAL))
const sym = assert(dlsym(handle, 'test'))
const test = bind(sym, 'u32', ['pointer'])

function on_event (counter) {
  return counter + 1
}

const on_event_cb = generate_callback({
  parameters: ['u32'],
  result: 'u32',
  callback: on_event
}).fn

const bench = new Bench()
const runs = 50000000

let last = test(on_event_cb)

function increment () {
  const val = test(on_event_cb)
  assert(val - last) === 1
  last = val
}

for (let j = 0; j < 10; j++) {
  bench.start('c-test')
  for (let i = 0; i < runs; i++) increment()
  bench.end(runs)
}
