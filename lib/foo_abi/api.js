const api = {
  noop: {
    parameters: [],
    result: 'void'
  },
  add1: {
    parameters: ['i32'],
    result: 'i32'
  }
}

const preamble = `
extern "C" {

__attribute__((noinline)) __attribute__((not_tail_called)) void noop () {
  asm volatile ("");
}

int32_t add1 (int32_t x) {
  return x + 1;
}

}
`
const name = 'foo_abi'

const constants = {}

// Opts this binding into lib/gen.js's bindingsAbi() codegen (lo_abi.h-
// conformant, zero v8::) instead of the default V8-specific bindings()
// -- see lib/build.js's compile_bindings, doc/WORK.E.1.md's "Result"
// section. foo_abi.cc is now fully auto-generated from api/preamble
// above; lo_abi_v8.cc gets compiled and linked in automatically too
// (compile_bindings does this whenever target === 'abi') -- no more
// hand-written foo_abi.cc or per-binding build.js needed.
const target = 'abi'

export { name, api, constants, preamble, target }
