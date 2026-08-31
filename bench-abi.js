// Benchmarks lib/foo (default V8-specific codegen) against lib/foo_abi
// (lo_abi.h ABI codegen, target: 'abi' in its api.js) -- both built from
// the exact same definitions (lib/foo_abi/shared.js), so any difference
// in the numbers is purely the dispatch mechanism, not the functions
// themselves. Rebuild either side with a different `target` (or
// LO_GEN_TARGET=v8|abi) to compare a code change on one side against
// the other. See doc/WORK.E.1.md/doc/PROFILING.md for the history.
//
// A representative subset of shared.js's functions, not all of them --
// one per tier/shape that matters for dispatch overhead specifically:
// noop (tier 0), add1 (tier 1, also exercises the Fast API Call/
// LO_V8_HAS_RECEIVER_KNO shim on the abi side), add1_i64 (BigInt
// marshaling cost, forced slow-only on both -- see shared.js's own
// nofast:true comment), sum_buffer (multi-arg + buffer, tier 1),
// str_len (string, tier 2 -- the one shape lo_abi_v8.cc has no Fast
// API Call path for at all yet).

import { Bench } from 'lib/bench.js'

const { assert, load, ptr } = lo
const bench = new Bench()
const iter = 5

function benchBoth (name, runs, fn) {
  for (const label of ['foo', 'foo_abi']) {
    const mod = load(label)[label]
    for (let i = 0; i < iter; i++) {
      bench.start(`${label}.${name}`)
      for (let j = 0; j < runs; j++) fn(mod)
      bench.end(runs)
    }
  }
}

const { foo } = load('foo')
const { foo_abi } = load('foo_abi')
assert(foo.noop() === undefined)
assert(foo_abi.noop() === undefined)
assert(foo.add1(1) === 2)
assert(foo_abi.add1(1) === 2)

const buf = ptr(new Uint8Array([1, 2, 3, 4, 5]))

while (1) {
  benchBoth('noop', 400000000, mod => assert(mod.noop() === undefined))
  benchBoth('add1', 400000000, mod => assert(mod.add1(1) === 2))
  benchBoth('add1_i64', 100000000, mod => assert(mod.add1_i64(1n) === 2n))
  benchBoth('sum_buffer', 100000000, mod => assert(mod.sum_buffer(buf.ptr, 5) === 15))
  benchBoth('str_len', 100000000, mod => assert(mod.str_len('hello world') === 11))
}
