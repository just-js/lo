import { Registers, Assembler } from 'lib/asm.js'

const { fastcall, bind_fastcall } = spin.load('fast').fast
const {
  rax, rbx, rcx, rdx, rsi, rdi, rbp, rsp, r8, r9, r10
} = Registers
const { ptr } = spin

const maxArgs = 30
const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18, string: 19
}

//TODO
/*
- handle string and buffer args for more than first arg
- float params
- handle u32 array for return > 32bit
- structs
*/

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

function stack_size (result, params) {
  let n = Math.max(params.length - 6, 0)
  if (n % 2 > 0) n++
  return n * 8
}

function compile_function_call (address, result, params) {
  asm.reset()
  if (params.length > 0 || result !== Types.void) {
    asm.push(rbx)
    asm.mov(rdi, rbx)
  }
  const size = stack_size(result, params)
  if (size > 0) asm.sub(rsp, size)
  let state_off = 56
  let stack_off = 0
  for (let i = 0; i < Math.min(params.length, maxArgs); i++) {
    if (i === 0) {
      asm.mov(rbx, rdi, 8)
    } else if (i === 1) {
      asm.mov(rbx, rsi, 16)
    } else if (i === 2) {
      asm.mov(rbx, rdx, 24)
    } else if (i === 3) {
      asm.mov(rbx, rcx, 32)
    } else if (i === 4) {
      asm.mov(rbx, r8, 40)
    } else if (i === 5) {
      asm.mov(rbx, r9, 48)
    } else {
      asm.mov(rbx, rsp, state_off, stack_off)
      state_off += 8
      stack_off += 8
    }
  }
  asm.call(address)
  if (result !== Types.void) asm.mov(rax, rbx, null, 0)
  if (size > 0) asm.add(rsp, size)
  if (params.length > 0 || result !== Types.void) asm.pop(rbx)
  asm.ret()
//console.log(asm.src())
//console.log(asm.codes())
  return asm.compile()
}

function compile_fastcall_wrapper (address, result, params) {
  asm.reset()
  let size = stack_size(result, params)
  let caller_off = size + 8
  let stack_off = 0
  if (size > 0) {
    asm.sub(rsp, size)
  }
  for (let i = 0; i < Math.min(params.length, maxArgs); i++) {
    if (i === 0) {
      if (params[i] === Types.buffer || params[i] === Types.u32array) {
        asm.mov(rsi, rdi, 8)
      } else if (params[i] === Types.string) {
        asm.mov(rsi, rdi, 0)
      } else {
        asm.mov(rsi, rdi)
      }
    } else if (i === 1) {
      if (params[i] === Types.buffer || params[i] === Types.u32array) {
        asm.mov(rdx, rsi, 8)
      } else if (params[i] === Types.string) {
        asm.mov(rdx, rsi, 0)
      } else {
        asm.mov(rdx, rsi)
      }
    } else if (i === 2) {
      if (params[i] === Types.buffer || params[i] === Types.u32array) {
        asm.mov(rcx, rdx, 8)
      } else if (params[i] === Types.string) {
        asm.mov(rcx, rdx, 0)
      } else {
        asm.mov(rcx, rdx)
      }
    } else if (i === 3) {
      asm.mov(r8, rcx)
    } else if (i === 4) {
      asm.mov(r9, r8)
    } else if (i === 5) {
      asm.mov(rsp, r9, caller_off)
      caller_off += 8
    } else {
      asm.mov(rsp, rsp, caller_off, stack_off)
      caller_off += 8
      stack_off += 8
    }
  }
  if (needs_unwrap(result)) {
    asm.mov(rsp, rsp, caller_off, stack_off)
  }
  if (size > 0) {
    asm.call(address)
    asm.add(rsp, size)
  } else {
    asm.jmp(address)
  }
  asm.ret()
//console.log(asm.src())
//console.log(asm.codes())
  return asm.compile()
}

function bind (address, res, par) {
  const state = ptr(new Uint8Array(8 + 32 + (32 * 8) + 8))
  const dv = new DataView(state.buffer)
  const result = Types[res]
  const params = par.map(n => Types[n])
  const maxParam = Math.min(params.length, maxArgs)
  const target = compile_function_call(address, result, params)
  const wrapper = compile_fastcall_wrapper(address, result, params)
  // 0-7:   set the fastcall wrapper pointer to first 64-bit slot in state
  //        this slot is also used to recieve result in %rax
  dv.setBigUint64(0, BigInt(wrapper), true)
  // 8:     set return type
  dv.setUint8(8, result)
  // 9:     set length of params
  dv.setUint8(9, maxParam)
  // 10-39: set param types - max 30 params
  for (let i = 0; i < maxParam; i++) dv.setUint8(10 + i, params[i])
  // 104:    set function call pointer to state->fn slot (for slowcall)
  dv.setBigUint64(40 + (32 * 8), BigInt(target), true)
  const fn = bind_fastcall(state.ptr)
  fn.state = state
  return fn
}

const asm = new Assembler()

export { bind, fastcall, Types, bind_fastcall, compile_function_call }
