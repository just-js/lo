import { run } from 'lib/bench.js'
import { wrapffi, Types } from 'lib/ffi.js'

const { assert } = spin

const { tcc } = spin.load('tcc')

let source = spin.cstr(`
typedef int int32_t;

int i = 0;
int func_trampoline (void* recv) {
  return i++;
}
`)

const TCC_OUTPUT_MEMORY = 1
const TCC_RELOCATE_AUTO = 1
const code = tcc.tcc_new()
tcc.tcc_set_output_type(code, TCC_OUTPUT_MEMORY)
let rc = tcc.tcc_compile_string(code, source.ptr)
spin.assert(rc === 0, `could not compile (${rc})`)
rc = tcc.tcc_relocate(code, TCC_RELOCATE_AUTO)
spin.assert(rc === 0, `could not relocate (${rc})`)
const addr = tcc.tcc_get_symbol(code, spin.cstr('func_trampoline').ptr)
spin.assert(addr, `could not locate symbol`)

const baseline = wrapffi(addr, Types.i32, [])
const repeat = Number(spin.args[2] || 10)
assert(baseline() === 0)
assert(baseline() === 1)
assert(baseline() === 2)

console.log(baseline.toString())

while (1) {
  run('baseline', baseline, 60000000, repeat)
}
