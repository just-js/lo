// Correctness tests for the lo_abi.h prototype's V8 backend
// (lo_abi_v8.cc) against lib/foo_abi -- both the three-tier slow-call
// dispatch and the V8 Fast API Call paths. V8 only takes the Fast API
// Call path once Turbofan/Maglev has actually optimized a call site, so
// a "call it once" test can't tell the fast and slow paths apart -- the
// warmup loops below exist specifically to exercise both. See
// doc/WORK.E.1.md/doc/PROFILING.md for the design and benchmarking
// history this is built on.
//
// foo_abi/noop/add1 are the prototype's current names, chosen to be the
// simplest possible shapes to validate the dispatch mechanism itself --
// expected to be renamed/refactored as the ABI work generalizes past
// this one binding.

const { assert, load } = lo
const { foo_abi } = load('foo_abi')

// --- shape sanity ---------------------------------------------------

assert(typeof foo_abi === 'object')
assert(typeof foo_abi.noop === 'function')
assert(typeof foo_abi.add1 === 'function')

// --- tier 0: 0-arg, LO_VOID result, with V8 Fast API Call path -------

assert(foo_abi.noop() === undefined)

// Warm the call site enough for Turbofan/Maglev to actually take the
// fast path (lo_abi_v8.cc's kNoArgsFastTable/DispatchNoArgsFast) rather
// than only exercising the slow FunctionCallbackInfo-based fallback
// (DispatchNoArgs) -- confirmed via perf during development that this
// many iterations reliably gets the fast path taken, not just reachable.
for (let i = 0; i < 200000; i++) assert(foo_abi.noop() === undefined)

// --- tier 1 proof of concept: 1-arg int32 -> int32, with the
// LO_V8_HAS_RECEIVER_KNO shim's fast path -----------------------------

assert(foo_abi.add1(0) === 1)
assert(foo_abi.add1(1) === 2)
assert(foo_abi.add1(-1) === 0)
assert(foo_abi.add1(-5) === -4)

// Real int32 wraparound -- confirms the value crossing the ABI boundary
// (both DispatchInt32Fast_Core's canonical-uint64 call into desc->fn and
// the real v8::CTypeInfo::Type::kInt32 typing on the fast-call path) is
// genuinely a 32-bit int, not silently widened to a double/int64
// somewhere along the way. Small test values alone wouldn't catch that
// class of bug.
assert(foo_abi.add1(2147483647) === -2147483648)
assert(foo_abi.add1(-2147483648) === -2147483647)

// Warm the call site the same way as noop() above, then re-check
// correctness post-optimization. This is the case that actually matters
// for a dual-path (slow + Fast API Call) design: a type mismatch between
// the slow path's argument extraction and the fast path's CTypeInfo
// could produce correct results only until the JIT kicks in and
// switches which compiled path is actually running.
for (let i = -100000; i < 100000; i++) {
  assert(foo_abi.add1(i) === i + 1)
}
assert(foo_abi.add1(2147483647) === -2147483648)
