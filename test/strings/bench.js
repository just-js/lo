// String passing and conversion speed, per route, string kind and length,
// to catch regressions in the fast-call string fix (PLAN task 144).
//
//   ./lo test/strings/bench.js [filter]
//   ./lo --no-turbo-fast-api-calls test/strings/bench.js [filter]
//
// filter: only cases whose name contains it, e.g. "binding" or "latin1 32".
// Compare the two runs: a route whose numbers don't change with fast calls
// off isn't getting the fast path (e.g. a JS argument count that doesn't
// match the C signature: V8 then compiles the slow call, silently).
// Each case also counts results that disagree with the reference UTF-8
// ("wrong"); those are the bugs test/strings/encode.js reports.

import { Bench } from 'lib/bench.js'
import { utf8_bytes, E_ACUTE, A_MACRON, ascii, mixed, libc_bind } from 'test/strings/common.js'

const { core, ptr } = lo
const filter = lo.args.slice(2).find(a => !a.startsWith('--')) || ''
const libc = libc_bind()
const bench = new Bench()
const MAX = 1 << 20
const out = ptr(new Uint8Array(3 * 16384 + 16))

// one loop per route, so each has its own type feedback and optimised code
function run_binding_strnlen (s, want, runs) {
  let wrong = 0
  for (let i = 0; i < runs; i++) if (core.strnlen_str(s, MAX) !== want) wrong++
  return wrong
}
function run_ffi_strnlen (s, want, runs) {
  let wrong = 0
  for (let i = 0; i < runs; i++) if (libc.strnlen_str(s, MAX) !== want) wrong++
  return wrong
}
function run_utf8_length (s, want, runs) {
  let wrong = 0
  for (let i = 0; i < runs; i++) if (lo.utf8Length(s) !== want) wrong++
  return wrong
}
function run_encode_into (s, want, runs) {
  let wrong = 0
  for (let i = 0; i < runs; i++) if (lo.utf8EncodeInto(s, out.ptr) !== want) wrong++
  return wrong
}
function run_encode (s, want, runs) {
  let wrong = 0
  for (let i = 0; i < runs; i++) if (lo.utf8Encode(s).length !== want) wrong++
  return wrong
}
function run_decode (bytes, want, runs) {
  let wrong = 0
  for (let i = 0; i < runs; i++) if (lo.utf8Decode(bytes.ptr, bytes.length).length !== want) wrong++
  return wrong
}

// [name, loop, input(s, bytes), wanted value(s, bytes), runs divisor]
const routes = [
  ['binding strnlen_str', run_binding_strnlen, (s) => s, (s, b) => b.length, 1],
  ['ffi strnlen', run_ffi_strnlen, (s) => s, (s, b) => b.length, 1],
  ['lo.utf8Length', run_utf8_length, (s) => s, (s, b) => b.length, 1],
  ['lo.utf8EncodeInto', run_encode_into, (s) => s, (s, b) => b.length, 1],
  ['lo.utf8Encode', run_encode, (s) => s, (s, b) => b.length, 4],
  ['lo.utf8Decode', run_decode, (s, b) => ptr(new Uint8Array(b)), (s) => s.length, 2],
]
const kinds = [
  ['ascii', len => ascii(len)],
  ['latin1', len => mixed(len, E_ACUTE)],
  ['two-byte', len => mixed(len, A_MACRON)],
]
const lengths = [8, 32, 128, 1024, 16384]
const runs_for = { 8: 4000000, 32: 3000000, 128: 1500000, 1024: 300000, 16384: 20000 }

for (const [route, loop, input, wanted, divisor] of routes) {
  for (const [kind, make] of kinds) {
    for (const len of lengths) {
      const name = `${route} ${kind} ${len}`
      if (filter && !name.includes(filter)) continue
      const s = make(len)
      const b = utf8_bytes(s)
      const arg = input(s, b)
      const want = wanted(s, b)
      const runs = Math.max(1000, Math.floor(runs_for[len] / divisor))
      loop(arg, want, runs >> 2) // warm up: optimise before timing
      bench.start(name)
      const wrong = loop(arg, want, runs)
      bench.end(runs)
      if (wrong) console.log(`    wrong: ${wrong} of ${runs}`)
    }
  }
}
