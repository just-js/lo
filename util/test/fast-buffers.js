import { tcc, Types } from 'lib/ffi.js'
import { run } from 'lib/bench.js'

const src = `
#include <string.h>

#ifndef _STDBOOL_H
#define _STDBOOL_H

#define bool _Bool
#define true 1
#define false 0

#endif

typedef signed char int8_t;
typedef short int int16_t;
typedef int int32_t;
typedef long int int64_t;

typedef unsigned char uint8_t;
typedef unsigned short int uint16_t;
typedef unsigned int uint32_t;
typedef unsigned long int uint64_t;

typedef long int intptr_t;
typedef unsigned long int uintptr_t;

struct FastApiTypedArray {
  uintptr_t length_;
  void* data;
};

struct FastOneByteString {
  const char* data;
  uint32_t length;
};

uint32_t original (const unsigned char* p_buf) {
  return ((uint32_t*)p_buf)[0];
}

uint32_t wrapped (void* p, struct FastApiTypedArray* const p_buf) {
  return ((uint32_t*)p_buf->data)[0];
}
`

const { assert, cstr, bindFastApi } = spin
const { TCC_OUTPUT_MEMORY, TCC_RELOCATE_AUTO } = tcc

const code = tcc.tcc_new()
assert(code)
assert(tcc.tcc_set_output_type(code, TCC_OUTPUT_MEMORY) === 0)
assert(tcc.tcc_compile_string(code, cstr(src).ptr) === 0)
assert(tcc.tcc_relocate(code, TCC_RELOCATE_AUTO) === 0)

const wrapped = tcc.tcc_get_symbol(code, cstr('wrapped').ptr)
assert(wrapped)
const original = tcc.tcc_get_symbol(code, cstr('original').ptr)
assert(original)
const fastcall = bindFastApi(original, wrapped, Types.i32, [Types.buffer])

const u8 = new Uint8Array(100)
u8[0] = u8[1] = u8[1] = u8[3] = 1
u8[4] = 100

const sub = u8.subarray(4, u8.length)
for (let i = 0; i < 100000000; i++) assert(fastcall(u8) === 16777473)
for (let i = 0; i < 100000000; i++) assert(fastcall(sub) === 100)

run('fastcall', () => fastcall(u8), 300000000, 10)