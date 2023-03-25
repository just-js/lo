import { run } from 'lib/bench.js'
import { FFIFunction, Types, tcc } from 'lib/ffi.js'

const { assert, ptr } = spin

let source = spin.cstr(`
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
const addr = tcc.tcc_get_symbol(code, spin.cstr('func_baseline').ptr)
spin.assert(addr, `could not locate symbol`)

const baseline = (new FFIFunction(addr, Types.i32, [])).prepare().call
const memcpy = spin.wrap(new Uint32Array(2), (new FFIFunction(spin.dlsym(0, 'memcpy'), Types.pointer, [Types.pointer, Types.string, Types.i32])).prepare().call, 3)

const data = (new Array(8).fill(0)).map(v => '1').join('')
const out = ptr(new Uint8Array(data.length))

assert(baseline() === 0)
assert(baseline() === 1)
assert(baseline() === 2)

console.log(memcpy(out.ptr, data, data.length))

const copy = () => memcpy(out.ptr, data, data.length)

//run('baseline', baseline, 60000000, 5)
run('memcpy', copy, 60000000, 5)
