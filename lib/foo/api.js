import { api, preamble, constants } from 'lib/foo_abi/shared.js'

// Same definitions as lib/foo_abi -- see shared.js. No `target` field,
// so lib/build.js's compile_bindings default (today's V8-specific
// codegen) applies, giving bench-abi.js a real V8-codegen baseline to
// compare the ABI path against, built from the exact same source.
const name = 'foo'

export { name, api, constants, preamble }
