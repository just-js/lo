import { Registers, Assembler } from 'lib/asm.js'

const { ptr, core, wrap, assert } = lo
const { fastcall, bind_fastcall, bind_slowcall, dlsym } = core
const {
  rax, rbx, rcx, rdx, rsi, rdi, rbp, rsp, r8, r9, r10, xmm0
} = Registers

const maxArgs = 30
const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18, string: 19
}

/*
# TODO

- handle string and buffer args for more than first arg
- fix how we handle strings (strdup) in slow calls
- float params - in simd/128 bit registers
- handle u32 array for return > 32bit
- structs - on the stack
- callbacks
- syscalls - calling convention
- have it so i can just define a syscall and create the code for it
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

/*
# TODO

- when structs are passed directly rather than through a pointer
- then we need to push the struct onto the stack, field by field
*/

function compile_function_call (address, result, params) {
  asm.reset()
  asm.push(rbx)
  asm.mov(rdi, rbx)
  const size = stack_size(result, params)
  if (size > 0) asm.sub(rsp, size)
  let state_off = 56
  let stack_off = 0
  for (let i = 0; i < Math.min(params.length, maxArgs); i++) {
    const type = params[i]
    if (i === 0) {
      if (type === Types.f32 || type === Types.f64) {
        asm.mov(rbx, xmm0, 8)
      } else {
        asm.mov(rbx, rdi, 8)
      }
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
  if (result !== Types.void) {
    if (result === Types.f32 || result === Types.f64) {
      asm.mov(xmm0, rbx, null, 0)
    } else {
      asm.mov(rax, rbx, null, 0)
    }
  }
  if (size > 0) asm.add(rsp, size)
  asm.pop(rbx)
  asm.ret()
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
    asm.ret()
  } else {
    asm.jmp(address)
  }
  return asm.compile()
}

function bind (address, res, strparams, slow = false) {
  const state = ptr(new Uint8Array(8 + 32 + (32 * 8) + 8))
  const dv = new DataView(state.buffer)
  const result = Types[res]
  const params = strparams.map(n => Types[n])
  const maxParam = Math.min(params.length, maxArgs)
  const target = compile_function_call(address, result, params)
  const slow_src = asm.src
  const wrapper = compile_fastcall_wrapper(address, result, params)
  const fast_src = asm.src
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
  // todo: wrap here
  if (slow) {
    const fn = bind_slowcall(state.ptr)
    fn.state = state
    return fn
  }
  const fn = bind_fastcall(state.ptr)
  fn.state = state
  fn.slow_src = slow_src
  fn.fast_src = fast_src
  return fn
}

function bindall (config, addr = 0) {
  const mod = {}
  for (const key of Object.keys(config)) {
    const binding = {}
    const { constants = {}, api = {}, native = {} } = config[key]
    Object.assign(binding, constants)
    for (const key of Object.keys(api)) {
      const { name, result, parameters } = api[key]
      binding[key] = bind(assert(dlsym(addr, name || key)), result, parameters)
      if (needs_unwrap(result)) {
        binding[key] = wrap(handle, binding[key], parameters.length)
      }
    }
    for (const key of Object.keys(native)) {
      binding[key] = native[key]
    }
    mod[key] = binding
  }
  return mod
}

const handle = new Uint32Array(2)
const asm = new Assembler()

export {
  bind, fastcall, Types, bind_fastcall, compile_function_call, asm, Assembler,
  bindall
}
