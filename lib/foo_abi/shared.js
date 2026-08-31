// Shared function definitions for the foo/foo_abi test bindings -- one
// place, not two hand-duplicated ones, since lib/foo/api.js and
// lib/foo_abi/api.js now just re-export this with a different name/
// target (see lib/build.js's compile_bindings `target` selection,
// doc/WORK.E.1.md). Rebuild the same definitions under each name to
// benchmark V8-specific codegen against the lo_abi.h ABI path directly
// (bench-abi.js) -- lo.load() dlopens lib/<name>/<name>.so, so getting
// both loadable at once genuinely needs two directories/two build
// outputs, just not two hand-written definitions.
//
// One function per currently-ABI-supported non-float lo_type_t (see
// lib/gen.js's getAbiType) -- no f32/f64, no structs (bindingsAbi has no
// equivalent for either by design). Constants below exercise
// lo_exports_set_i32/u64 (E.9) -- 'i32'/'u32'/'u64', the only three
// types any real binding's constants block actually uses (surveyed all
// 43 lib/*/api.js files directly).

const api = {
  noop: {
    parameters: [],
    result: 'void'
  },
  add1: {
    parameters: ['i32'],
    result: 'i32'
  },
  // result: 'u8', not 'bool' -- bool-as-a-*result* is a real, separate
  // cross-codegen inconsistency (V8-codegen returns a plain uint8_t/
  // Number, lo_abi_v8.cc returns a real JS boolean), found while testing
  // this. Tracked in WORK.md for later; sidestepped here by testing bool
  // only as a parameter (which is consistent) and returning u8 instead.
  not_bool: {
    parameters: ['bool'],
    result: 'u8'
  },
  neg_i8: {
    parameters: ['i8'],
    result: 'i8'
  },
  inv_u8: {
    parameters: ['u8'],
    result: 'u8'
  },
  neg_i16: {
    parameters: ['i16'],
    result: 'i16'
  },
  inv_u16: {
    parameters: ['u16'],
    result: 'u16'
  },
  add1_u32: {
    parameters: ['u32'],
    result: 'u32'
  },
  // nofast: true on both -- lib/gen.js's Fast API Call codegen never sets
  // CFunctionInfo::Int64Representation, so it always defaults to kNumber
  // (plain double) regardless of what the slow path does. Now that i64/
  // u64 are explicitly BigInt on the slow path (see WORK.md), a fast-
  // callable i64/u64 function would mismatch its own slow path once a
  // call site got JIT-optimized. Forced slow-only until that's fixed --
  // real follow-up work, not done here.
  add1_i64: {
    parameters: ['i64'],
    result: 'i64',
    nofast: true
  },
  add1_u64: {
    parameters: ['u64'],
    result: 'u64',
    nofast: true
  },
  add1_isize: {
    parameters: ['isz'],
    result: 'isz'
  },
  add1_usize: {
    parameters: ['usz'],
    result: 'usz'
  },
  identity_ptr: {
    parameters: ['pointer'],
    result: 'pointer'
  },
  sum_buffer: {
    parameters: ['buffer', 'u32'],
    pointers: ['uint8_t*'],
    result: 'u32'
  },
  str_len: {
    parameters: ['string'],
    result: 'u32'
  },
  noop_slow: {
    parameters: [],
    result: 'void',
    name: 'noop',
    nofast: true
  },
  add1_slow: {
    parameters: ['i32'],
    result: 'i32',
    name: 'add1',
    nofast: true
  },
  // result: 'u8', not 'bool' -- bool-as-a-*result* is a real, separate
  // cross-codegen inconsistency (V8-codegen returns a plain uint8_t/
  // Number, lo_abi_v8.cc returns a real JS boolean), found while testing
  // this. Tracked in WORK.md for later; sidestepped here by testing bool
  // only as a parameter (which is consistent) and returning u8 instead.
  not_bool_slow: {
    parameters: ['bool'],
    result: 'u8',
    name: 'not_bool',
    nofast: true
  },
  neg_i8_slow: {
    parameters: ['i8'],
    result: 'i8',
    name: 'neg_i8',
    nofast: true
  },
  inv_u8_slow: {
    parameters: ['u8'],
    result: 'u8',
    name: 'inv_u8',
    nofast: true
  },
  neg_i16_slow: {
    parameters: ['i16'],
    result: 'i16',
    name: 'neg_i16',
    nofast: true
  },
  inv_u16_slow: {
    parameters: ['u16'],
    result: 'u16',
    name: 'inv_u16',
    nofast: true
  },
  add1_u32_slow: {
    parameters: ['u32'],
    result: 'u32',
    name: 'add1_u32',
    nofast: true
  },
  add1_isize_slow: {
    parameters: ['isz'],
    result: 'isz',
    name: 'add1_isize',
    nofast: true
  },
  add1_usize_slow: {
    parameters: ['usz'],
    result: 'usz',
    name: 'add1_usize',
    nofast: true
  },
  identity_ptr_slow: {
    parameters: ['pointer'],
    result: 'pointer',
    name: 'identity_ptr',
    nofast: true
  },
  sum_buffer_slow: {
    parameters: ['buffer', 'u32'],
    pointers: ['uint8_t*'],
    result: 'u32',
    name: 'sum_buffer',
    nofast: true
  },
  str_len_slow: {
    parameters: ['string'],
    result: 'u32',
    name: 'str_len',
    nofast: true
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

uint8_t not_bool (uint8_t x) {
  return x ? 0 : 1;
}

int8_t neg_i8 (int8_t x) {
  return (int8_t)(-x);
}

uint8_t inv_u8 (uint8_t x) {
  return (uint8_t)(~x);
}

int16_t neg_i16 (int16_t x) {
  return (int16_t)(-x);
}

uint16_t inv_u16 (uint16_t x) {
  return (uint16_t)(~x);
}

uint32_t add1_u32 (uint32_t x) {
  return x + 1;
}

int64_t add1_i64 (int64_t x) {
  return x + 1;
}

uint64_t add1_u64 (uint64_t x) {
  return x + 1;
}

intptr_t add1_isize (intptr_t x) {
  return x + 1;
}

uintptr_t add1_usize (uintptr_t x) {
  return x + 1;
}

void* identity_ptr (void* p) {
  return p;
}

uint32_t sum_buffer (uint8_t* buf, uint32_t len) {
  uint32_t s = 0;
  for (uint32_t i = 0; i < len; i++) s += buf[i];
  return s;
}

uint32_t str_len (const char* s) {
  uint32_t n = 0;
  while (s[n]) n++;
  return n;
}

#define FOO_ANSWER 42
#define FOO_FLAG 16u
#define FOO_BIG 18446744073709551615ull

}
`

const constants = {
  FOO_ANSWER: 'i32',
  FOO_FLAG: 'u32',
  FOO_BIG: 'u64'
}

export { api, preamble, constants }
