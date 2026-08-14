// Functional smoke test for the `core`-only addon built by ./Makefile
// (PLAN.md task 20 / LO-BINDINGS.md Phase 1). Loads lo.node directly -
// deliberately not using hooks.js/lib's module-loader hooks, since those
// assume the full node-gyp build layout (build/Release/lo.node) this
// hand-rolled build doesn't use.
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { lo } = require('./lo.node')
const { core } = lo.library('core')

function must (value, msg) {
  if (!value) throw new Error(msg || 'expected a truthy value')
  return value
}

// string encoding round trip - exercises the V8-version-gated code path
// in lo.h/lo.cc (LO_V8_STRING_WRITE_V2 - see LO-BINDINGS.md)
must(Buffer.from(lo.utf8Encode('hello from lo addon')).toString() === 'hello from lo addon', 'utf8Encode mismatch')
must(lo.utf8Length('hello') === 5, 'utf8Length mismatch')
must(Buffer.from(lo.latin1Encode('abc')).toString() === 'abc', 'latin1Encode mismatch')

// real native call through core.dlopen/dlsym - not just symbol presence
must(typeof core.dlopen === 'function', 'core.dlopen missing')
const handle = must(core.dlopen(`${import.meta.dirname}/core-test.so`, core.RTLD_NOW), 'dlopen failed')
const sym = must(core.dlsym(handle, 'add'), 'dlsym(add) failed')

console.log(`lo ${lo.version.lo} / v8 ${lo.version.v8} on ${lo.os()}/${lo.arch()}`)
console.log(`dlopen handle=${handle} dlsym(add)=${sym}`)
console.log('OK')
