import { compile } from 'lib/compiler.js'

const { ptr } = spin
const { fastcall, bind_fastcall } = spin.load('fast').fast

const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18, string: 19
}

function address_as_bytes (address) {
  return Array.from(new Uint8Array((new BigUint64Array([BigInt(address)])).buffer))
}

function needs_unwrap (t) {
  switch (t) {
    case Types.buffer:
    case Types.pointer:
    case Types.u32array:
    case Types.u64:
    case Types.i64:
      return true
    default:
      return false
  }
}

function compile_function_call (address, result, params) {
  const codes = []
  if (params.length > 0 || result !== Types.void) {
    // push %rbx
    codes.push(0x53)
    // movq  %rdi, %rbx
    codes.push([0x48, 0x89, 0xfb])
  }
  if (params.length > 0) {
    // movq  8(%rbx), %rdi
    codes.push([0x48, 0x8b, 0x7b, 0x08])
  }
  if (params.length > 1) {
    // movq  16(%rbx), %rsi
    codes.push([0x48, 0x8b, 0x73, 0x10])
  }
  if (params.length > 2) {
    // movq  24(%rbx), %rdx
    codes.push([0x48, 0x8b, 0x53, 0x18])
  }
  if (params.length > 3) {
    // movq  32(%rbx), %rcx
    codes.push([0x48, 0x8b, 0x4b, 0x20])
  }
  if (params.length > 4) {
    // movq  40(%rbx), %r8
    codes.push([0x4c, 0x8b, 0x43, 0x28])
  }
  if (params.length > 5) {
    // movq  48(%rbx), %r9
    codes.push([0x4c, 0x8b, 0x4b, 0x30])
  }
  // movabs {fn address}, %rax
  codes.push([0x48, 0xb8, ...address_as_bytes(address)])
  // call  *%rax
  codes.push([0xff, 0xd0])
  if (result !== Types.void) {
    // movq  %rax, (%rbx)
    codes.push([0x48, 0x89, 0x03])    
  }
  if (params.length > 0 || result !== Types.void) {
    // pop %rbx
    codes.push(0x5b)
  }
  // ret
  codes.push(0xc3)
  return compile(ptr(new Uint8Array(codes.flat())))
}

function compile_fastcall_wrapper (address, result, params) {
  const codes = []
  if (needs_unwrap(result)) params.push(Types.u32array)
  if (params.length > 0) {
    switch (params[0]) {
      case Types.buffer:
      case Types.u32array:
        // movq    8(%rsi), %rdi
        codes.push([0x48, 0x8b, 0x7e, 0x08])
        break;
      default:
        // movq    %rsi, %rdi
        codes.push([0x48, 0x89, 0xf7])
        break;
    }
  }
  if (params.length > 1) {
    switch (params[1]) {
      case Types.buffer:
      case Types.u32array:
        // movq    8(%rdx), %rsi
        codes.push([0x48, 0x8b, 0x72, 0x08])
        break;
      default:
        // movq    %rdx, %rsi
        codes.push([0x48, 0x89, 0xd6])
        break;
    }
  }
  if (params.length > 2) {
    switch (params[2]) {
      case Types.buffer:
      case Types.u32array:
        // movq    8(%rcx), %rdx
        codes.push([0x48, 0x8b, 0x51, 0x08])
        break;
      default:
        // movq    %rcx, %rdx
        codes.push([0x48, 0x89, 0xca])
        break;
    }
  }
  if (params.length > 3) {
    switch (params[3]) {
      case Types.buffer:
      case Types.u32array:
        // movq    8(%r8), %rcx
        codes.push([0x49, 0x8b, 0x48, 0x08])
        break;
      default:
        // movq    %r8, %rcx
        codes.push([0x4c, 0x89, 0xc1])
        break;
    }
  }
  if (params.length > 4) {
    switch (params[4]) {
      case Types.buffer:
      case Types.u32array:
        // movq    8(%r9), %r8
        codes.push([0x4d, 0x8b, 0x41, 0x08])
        break;
      default:
        // movq    %r9, %r8
        codes.push([0x4d, 0x89, 0xc8])
        break;
    }
  }
  if (params.length > 5) {
    switch (params[5]) {
      case Types.buffer:
      case Types.u32array:
        // movq    (%rsp), %r9
        codes.push([0x4c, 0x8b, 0x0c, 0x24])
        // movq    8(%r9), %r9
        codes.push([0x4d, 0x8b, 0x49, 0x08])
        break;
      default:
        // movq    (%rsp), %r9
        codes.push([0x4c, 0x8b, 0x0c, 0x24])
        break;
    }
  }
  // movabs {fn address}, %rax
  codes.push([0x48, 0xb8, ...address_as_bytes(address)])
  // call  *%rax
  codes.push([0xff, 0xd0])
  // ret
  codes.push(0xc3)
  return compile(ptr(new Uint8Array(codes.flat())))
}

function bind (address, res, par) {
  const state = ptr(new Uint8Array(8 + 32 + (16 * 8) + (16 * 8) + 8))
  const dv = new DataView(state.buffer)
  const result = Types[res]
  const params = par.map(n => Types[n])
  const fn = compile_function_call(address, result, params)
  const wrapper = compile_fastcall_wrapper(address, result, params)
  // 0-7:   set the fastcall wrapper pointer to first 64-bit slot in state
  dv.setBigUint64(0, BigInt(wrapper), true)
  // 8:     set return type
  dv.setUint8(8, result)
  // 9:     set length of params
  dv.setUint8(9, params.length)
  // 10-39: set param types - max 30 params
  for (let i = 0; i < Math.min(params.length, 30); i++) {
    dv.setUint8(10 + i, params[i])
  }
  // 104:    set function call pointer to %rsp(1) slot
  dv.setBigUint64(40 + (8 * 8), BigInt(fn), true)
  // 120:    set function pointer to %rsp(1) slot
  dv.setBigUint64(40 + (10 * 8), BigInt(address), true)
  const foo = bind_fastcall(state.ptr)
  foo.state = state
  return foo
}

export { bind, fastcall }
