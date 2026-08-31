// Correctness tests for the lo_abi.h prototype's V8 backend
// (lo_abi_v8.cc), covering both the three-tier slow-call dispatch and
// the V8 Fast API Call paths, and comparing against lib/foo -- the same
// function definitions (lib/foo_abi/shared.js) built under the default
// V8-specific codegen instead, via lib/build.js's `target` field. V8
// only takes the Fast API Call path once Turbofan/Maglev has actually
// optimized a call site, so a "call it once" test can't tell the fast
// and slow paths apart -- the warmup loops below exist specifically to
// exercise both. See doc/WORK.E.1.md/doc/PROFILING.md for the design
// and benchmarking history this is built on.
//
// foo/foo_abi/shared.js's function names are the prototype's current
// surface, expected to be renamed/refactored as the ABI work
// generalizes past these two test bindings.
//
// Known, deliberately-not-fixed-here cross-codegen gaps (see WORK.md):
// - i64/u64 are explicitly BigInt on both targets now; a fast-callable
//   i64/u64 function would still mismatch its own slow path once
//   optimized, since lib/gen.js's Fast API Call codegen never sets
//   CFunctionInfo::Int64Representation -- forced nofast:true in
//   shared.js until that's fixed.
// - `bool` as a *result* type differs (V8-codegen: plain uint8_t/
//   Number; lo_abi_v8.cc: real JS boolean) -- shared.js's not_bool()
//   sidesteps this by testing bool only as a parameter (consistent)
//   and returning u8 instead.

const { assert, load, ptr } = lo

function checkBinding (mod, label) {
  assert(mod.noop() === undefined, `${label}.noop`)
  assert(mod.add1(41) === 42, `${label}.add1`)
  assert(mod.not_bool(1) === 0, `${label}.not_bool(1)`)
  assert(mod.not_bool(0) === 1, `${label}.not_bool(0)`)
  assert(mod.neg_i8(5) === -5, `${label}.neg_i8`)
  assert(mod.neg_i8(-128) === -128, `${label}.neg_i8 overflow`)
  assert(mod.inv_u8(0) === 255, `${label}.inv_u8`)
  assert(mod.neg_i16(1000) === -1000, `${label}.neg_i16`)
  assert(mod.inv_u16(0) === 65535, `${label}.inv_u16`)
  assert(mod.add1_u32(4294967295) === 0, `${label}.add1_u32 wraparound`)

  // i64/u64: explicitly BigInt, consistently, on both targets (a real
  // decision -- see WORK.md -- not the default either codegen started
  // with; lib/gen.js's generic parameter-cast fallback used to silently
  // accept a plain Number here and misbehave on real 64-bit values).
  assert(mod.add1_i64(9223372036854775806n) === 9223372036854775807n, `${label}.add1_i64`)
  assert(mod.add1_u64(18446744073709551614n) === 18446744073709551615n, `${label}.add1_u64`)

  // isz/usz: plain Number, like pointer -- deliberately NOT BigInt
  // (pointer-sized values are precise enough as a double for anything
  // targeted here, and BigInt has real overhead not worth paying for
  // the common case of passing sizes/offsets/pointers into C APIs).
  assert(mod.add1_isize(5) === 6, `${label}.add1_isize`)
  assert(mod.add1_usize(5) === 6, `${label}.add1_usize`)
  assert(typeof mod.add1_isize(5) === 'number', `${label}.add1_isize is a number, not bigint`)
  assert(typeof mod.add1_usize(5) === 'number', `${label}.add1_usize is a number, not bigint`)

  const buf = ptr(new Uint8Array([1, 2, 3, 4, 5]))
  assert(Number(mod.identity_ptr(buf.ptr)) === buf.ptr, `${label}.identity_ptr`)
  assert(mod.sum_buffer(buf.ptr, 5) === 15, `${label}.sum_buffer`)
  assert(mod.str_len('hello world') === 11, `${label}.str_len`)
}

const { foo } = load('foo')
checkBinding(foo, 'foo (v8)')

const { foo_abi } = load('foo_abi')
checkBinding(foo_abi, 'foo_abi (abi)')

// --- tier 0: 0-arg, LO_VOID result, with V8 Fast API Call path -------
// (foo_abi-specific: proving the ABI's own Fast API Call mechanism
// actually gets taken, not just that it's reachable.)

// Warm the call site enough for Turbofan/Maglev to actually take the
// fast path (lo_abi_v8.cc's kNoArgsFastTable/DispatchNoArgsFast) rather
// than only exercising the slow FunctionCallbackInfo-based fallback
// (DispatchNoArgs) -- confirmed via perf during development that this
// many iterations reliably gets the fast path taken, not just reachable.
for (let i = 0; i < 200000; i++) assert(foo_abi.noop() === undefined)

// --- tier 1 proof of concept: 1-arg int32 -> int32, with the
// LO_V8_HAS_RECEIVER_KNO shim's fast path -----------------------------

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
