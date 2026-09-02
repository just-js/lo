import { C } from 'lib/C.js'
import { Bench } from 'lib/bench.js'

const { assert, load } = lo
const native = load('bar').bar
const ffi = C`
${{ 
  noop: { result: 'void', parameters: [] },
  noarg_i32: { result: 'i32', parameters: [] },
  noop_slow: { result: 'void', parameters: [], nofast: true, name: 'noop' },
  noarg_i32_slow: { result: 'i32', parameters: [], nofast: true, name: 'noarg_i32' },
}}

#include <stdlib.h>
#include <stdint.h>

void noop () {

}

uint32_t noarg_i32 () {
  return 1;
}
`

const bench = new Bench()
const iter = 5
const runs = 300000000

/*
for (let i = 0; i < iter; i++) {
  bench.start('native.noop')
  for (let j = 0; j < runs; j++) assert(native.noop() === undefined)
  bench.end(runs)
}

for (let i = 0; i < iter; i++) {
  bench.start('ffi.noop')
  for (let j = 0; j < runs; j++) assert(ffi.noop() === undefined)
  bench.end(runs)
}
*/

for (let i = 0; i < iter; i++) {
  bench.start('native.noop_slow')
  for (let j = 0; j < runs; j++) assert(native.noop_slow() === undefined)
  bench.end(runs)
}

for (let i = 0; i < iter; i++) {
  bench.start('ffi.noop_slow')
  for (let j = 0; j < runs; j++) assert(ffi.noop_slow() === undefined)
  bench.end(runs)
}
/*
for (let i = 0; i < iter; i++) {
  bench.start('native.noarg_i32')
  for (let j = 0; j < runs; j++) assert(native.noarg_i32() === 1)
  bench.end(runs)
}

for (let i = 0; i < iter; i++) {
  bench.start('ffi.noarg_i32')
  for (let j = 0; j < runs; j++) assert(ffi.noarg_i32() === 1)
  bench.end(runs)
}
*/

for (let i = 0; i < iter; i++) {
  bench.start('native.noarg_i32_slow')
  for (let j = 0; j < runs; j++) assert(native.noarg_i32_slow() === 1)
  bench.end(runs)
}

for (let i = 0; i < iter; i++) {
  bench.start('ffi.noarg_i32_slow')
  for (let j = 0; j < runs; j++) assert(ffi.noarg_i32_slow() === 1)
  bench.end(runs)
}
