import { wrapffi, tcc, Types } from 'lib/ffi.js'

const { assert, cstr, bindFastApi, wrap } = spin
const { TCC_OUTPUT_MEMORY, TCC_RELOCATE_AUTO } = tcc
const { AD, A0, AR, AG, AY, AB, AM, AC, AW } = spin.colors

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

uint32_t counter = 0;

void zero_args_return_void (void* p) {
  counter++;
}

int32_t zero_args_return_i32 (void* p) {
  counter++;
  return (1 << 31) - 1;
}

uint32_t zero_args_return_u32 (void* p) {
  counter++;
  return 0xFFFFFFFF;
}

void zero_args_return_u64 (void* p, struct FastApiTypedArray* const p_ret) {
  counter++;
  ((uint64_t**)p_ret->data)[0] = (uint64_t*)4294967297;
}

const char* zero_args_return_string (void* p, struct FastOneByteString* const p_ret) {
  counter++;
  p_ret->data = "hello";
  p_ret->length = 5;
}

int32_t string_arg_return_i32 (void* p, struct FastOneByteString* const p_ret) {
  counter++;
  return strnlen(p_ret->data, p_ret->length);
}

uint32_t reset_counter () {
  uint32_t c = counter;
  counter = 0;
  return c;
}
`

function zero_args_return_void () {
  slowcounter++
}

function zero_args_return_i32 () {
  slowcounter++
  return max_s32
}

function zero_args_return_u32 () {
  slowcounter++
  return 0xFFFFFFFF
}

function zero_args_return_u64 (u32) {
  slowcounter++
  const v = 4294967297
  u32[0] = v - (2 ** 32)
  u32[1] = v >> 32
}

function string_arg_return_i32 (str) {
  slowcounter++
  return str.length
}

function bind (fn, rtype = Types.void, params = []) {
  const { name } = fn
  const addr = tcc.tcc_get_symbol(code, cstr(name).ptr)
  assert(addr)
  const fastcall = bindFastApi(addr, rtype, params, fn)
  return fastcall
}

function fast_alltogether () {
  let rc = fast_zero_args_return_void() || 0
  rc += fast_zero_args_return_i32()
  rc += fast_zero_args_return_u32()
  rc += fast_zero_args_return_u64()
  rc += fast_string_arg_return_i32('hello')
  return rc
}

function alltogether () {
  let rc = zero_args_return_void() || 0
  rc += zero_args_return_i32()
  rc += zero_args_return_u32()
  rc += wrapped_zero_args_return_u64()
  rc += string_arg_return_i32('hello')
  return rc
}

function bench () {
  let iter = 100000000
  let start = 0
  let elapsed = 0
  let rate = 0.0
  let nanos = 0.0
  let i = 0
  let counter = 0
  let rc = 0
  let expected = 0

  iter = 100000000

  expected = zero_args_return_void()
  slowcounter = 0
  counter = reset_counter()
  start = Date.now()
  for (i = 0; i < iter; i++) rc = fast_zero_args_return_void()
  elapsed = Date.now() - start
  rate = iter / (elapsed / 1000)
  nanos = Math.floor(1000000000 / rate)
  //console.log(`${expected} === ${rc} ?`)
  assert(expected === rc, `${expected} !== ${rc}`)
  counter = reset_counter()
  console.log(`zero_args_return_void ${AC}ops${AD} ${rate.toFixed(0)} ${AC}ns/op${AD} ${nanos.toFixed(0)} ${AG}fast${AD} ${counter} ${AY}slow${AD} ${slowcounter} ${AM}diff${AD} ${iter - counter}`)

  expected = zero_args_return_i32()
  slowcounter = 0
  counter = reset_counter()
  start = Date.now()
  for (i = 0; i < iter; i++) rc = fast_zero_args_return_i32()
  elapsed = Date.now() - start
  rate = iter / (elapsed / 1000)
  nanos = Math.floor(1000000000 / rate)
  //console.log(`${expected} === ${rc} ?`)
  assert(expected === rc, `${expected} !== ${rc}`)
  counter = reset_counter()
  console.log(`zero_args_return_i32 ${AC}ops${AD} ${rate.toFixed(0)} ${AC}ns/op${AD} ${nanos.toFixed(0)} ${AG}fast${AD} ${counter} ${AY}slow${AD} ${slowcounter} ${AM}diff${AD} ${iter - counter}`)

  expected = zero_args_return_u32()
  slowcounter = 0
  counter = reset_counter()
  start = Date.now()
  for (i = 0; i < iter; i++) rc = fast_zero_args_return_u32()
  elapsed = Date.now() - start
  rate = iter / (elapsed / 1000)
  nanos = Math.floor(1000000000 / rate)
  //console.log(`${expected} === ${rc} ?`)
  assert(expected === rc, `${expected} !== ${rc}`)
  counter = reset_counter()
  console.log(`zero_args_return_u32 ${AC}ops${AD} ${rate.toFixed(0)} ${AC}ns/op${AD} ${nanos.toFixed(0)} ${AG}fast${AD} ${counter} ${AY}slow${AD} ${slowcounter} ${AM}diff${AD} ${iter - counter}`)

  expected = wrapped_zero_args_return_u64()
  slowcounter = 0
  counter = reset_counter()
  start = Date.now()
  for (i = 0; i < iter; i++) rc = fast_zero_args_return_u64()
  elapsed = Date.now() - start
  rate = iter / (elapsed / 1000)
  nanos = Math.floor(1000000000 / rate)
  //console.log(`${expected} === ${rc} ?`)
  assert(expected === rc, `${expected} !== ${rc}`)
  counter = reset_counter()
  console.log(`zero_args_return_u64 ${AC}ops${AD} ${rate.toFixed(0)} ${AC}ns/op${AD} ${nanos.toFixed(0)} ${AG}fast${AD} ${counter} ${AY}slow${AD} ${slowcounter} ${AM}diff${AD} ${iter - counter}`)

  expected = alltogether()
  slowcounter = 0
  counter = reset_counter()
  start = Date.now()
  for (i = 0; i < iter; i++) rc = fast_alltogether()
  elapsed = Date.now() - start
  rate = iter / (elapsed / 1000)
  nanos = Math.floor(1000000000 / rate)
  //console.log(`${expected} === ${rc} ?`)
  assert(expected === rc, `${expected} !== ${rc}`)
  counter = reset_counter()
  console.log(`alltogether ${AC}ops${AD} ${rate.toFixed(0)} ${AC}ns/op${AD} ${nanos.toFixed(0)} ${AG}fast${AD} ${counter} ${AY}slow${AD} ${slowcounter} ${AM}diff${AD} ${(iter * 5) - counter}`)

  expected = string_arg_return_i32('hello')
  slowcounter = 0
  counter = reset_counter()
  start = Date.now()
  for (i = 0; i < iter; i++) rc = fast_string_arg_return_i32('hello')
  elapsed = Date.now() - start
  rate = iter / (elapsed / 1000)
  nanos = Math.floor(1000000000 / rate)
  //console.log(`${expected} === ${rc} ?`)
  assert(expected === rc, `${expected} !== ${rc}`)
  counter = reset_counter()
  console.log(`string_arg_return_i32 ${AC}ops${AD} ${rate.toFixed(0)} ${AC}ns/op${AD} ${nanos.toFixed(0)} ${AG}fast${AD} ${counter} ${AY}slow${AD} ${slowcounter} ${AM}diff${AD} ${iter - counter}`)

  spin.nextTick(bench)
}


let slowcounter = 0
const u32 = new Uint32Array(2)
const max_s32 = new Int32Array([Math.pow(2, 31) - 1])[0]
const code = tcc.tcc_new()
assert(code)
assert(tcc.tcc_set_output_type(code, TCC_OUTPUT_MEMORY) === 0)
assert(tcc.tcc_compile_string(code, cstr(src).ptr) === 0)
assert(tcc.tcc_relocate(code, TCC_RELOCATE_AUTO) === 0)
const fast_zero_args_return_i32 = bind(zero_args_return_i32, Types.i32)
const fast_zero_args_return_void = bind(zero_args_return_void, Types.void)
const fast_zero_args_return_u32 = bind(zero_args_return_u32, Types.u32)
const wrapped_zero_args_return_u64 = wrap(u32, zero_args_return_u64, 0)
const fast_zero_args_return_u64 = wrap(u32, bind(wrapped_zero_args_return_u64, Types.void, [Types.u32array]), 0)
const fast_string_arg_return_i32 = bind(string_arg_return_i32, Types.i32, [Types.string])

const addr = tcc.tcc_get_symbol(code, cstr('reset_counter').ptr)
assert(addr)

const reset_counter = wrapffi(addr, Types.u32, [])

assert(fast_zero_args_return_i32() === zero_args_return_i32())
assert(fast_zero_args_return_u32() === zero_args_return_u32())
assert(fast_zero_args_return_u64() === wrapped_zero_args_return_u64())
assert(fast_alltogether() === alltogether())

//bench()

//tcc.tcc_delete(code)
