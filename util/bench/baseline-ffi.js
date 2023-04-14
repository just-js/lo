import { run } from 'lib/bench.js'
import { FFIFunction, Types, tcc } from 'lib/ffi.js'

const { assert, cstr } = spin

let source = cstr(`
int i = 0;
int func_baseline () {
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
const addr = tcc.tcc_get_symbol(code, cstr('func_baseline').ptr)
spin.assert(addr, `could not locate symbol`)

const baseline = (new FFIFunction(addr, Types.i32, [])).prepare().call

assert(baseline() === 0)
assert(baseline() === 1)
assert(baseline() === 2)

run('baseline', baseline, 60000000, 5)
