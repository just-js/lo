import { api, preamble, constants } from 'lib/foo_abi/shared.js'

const name = 'foo_abi'

// Opts this binding into lib/gen.js's bindingsAbi() codegen (lo_abi.h-
// conformant, zero v8::) instead of the default V8-specific bindings()
// -- see lib/build.js's compile_bindings, doc/WORK.E.1.md's "Result"
// section. foo_abi.cc is fully auto-generated from api/preamble in
// shared.js; lo_abi_v8.cc gets compiled and linked in automatically too
// (compile_bindings does this whenever target === 'abi') -- no more
// hand-written foo_abi.cc or per-binding build.js needed.
const target = 'abi'

export { name, api, constants, preamble, target }
