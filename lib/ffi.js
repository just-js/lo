import { Assembler, Compiler, Registers } from 'lib/asm.js'

const { ptr, core, wrap, assert } = lo
const { 
  bind_fastcall, bind_slowcall, dlsym, struct_fastcall_size 
} = core

/*
from: lib/core/api.js

typedef void (*lo_fast_call)(void*);

fastcall: {
  parameters: ['pointer'],
  pointers: ['struct fastcall*'],
  result: 'void',
  name: 'lo_fastcall'
},

void lo_fastcall (struct fastcall* state) {
  ((lo_fast_call)state->fn)(&state->args);
}

void bind_slowcallSlow(const FunctionCallbackInfo<Value> &args) {
void bind_fastcallSlow(const FunctionCallbackInfo<Value> &args) {
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
    Local<Integer>::Cast(args[0])->Value());
}

struct fastcall {
  void* wrapper;      // 0-7   :   v8 fastcall wrapper function pointer
  uint8_t result;     // 8     :   the type of the result
  uint8_t nparam;     // 9     :   the number of args (max 255) 
  uint8_t param[30];  // 10-39 :   an array of types of the arguments
  uint64_t args[32];  // 40-295:   an array of pointer slots for arguments
                      // these will be filled in dynamically by 
                      // lo::core::SlowCallback for the slow call
                      // and then the slowcall wrapper will shift them from
                      // this structure into regs + stack and make the call
  void* fn;           // 296-303:  the slowcall wrapper function pointer
};


https://godbolt.org/z/zqPrY4r1P

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

// todo: rules for floating point and structs
// todo: if result is a struct we have to do weird things
function stack_size (params) {
  let n = Math.max(params.length - 6, 0)
  if (n % 2 > 0) n++
  return n * 8
}

function compile_slowcall (address, result, params) {
  asm.reset()
  asm.push(rbx)
  asm.movreg(rdi, rbx)
  // todo we could just push rdi and use it instead of rbx
  const size = stack_size(params)
  if (size > 0) asm.sub(rsp, size)
  let state_off = 56
  let stack_off = 0
  for (let i = 0; i < Math.min(params.length, max_args); i++) {
    const type = params[i]
    if (i === 0) {
      // todo, function map/vtable
      if (type === Types.f32 || type === Types.f64) {
        // todo
        //asm.mov(rbx, xmm0, 8)
      } else {
        asm.movsrc(rbx, rdi, 8) // we start at offset 8 as first slot is for the result
      }
    } else if (i === 1) {
      asm.movsrc(rbx, rsi, 16)
    } else if (i === 2) {
      asm.movsrc(rbx, rdx, 24)
    } else if (i === 3) {
      asm.movsrc(rbx, rcx, 32)
    } else if (i === 4) {
      asm.movsrc(rbx, r8, 40)
    } else if (i === 5) {
      asm.movsrc(rbx, r9, 48)
    } else {
      asm.movsrc(rbx, rax, state_off)
      asm.movdest(rax, rsp, stack_off)
      state_off += 8
      stack_off += 8
    }
  }
  asm.call(address)
  if (result !== Types.void) {
    if (result === Types.f32 || result === Types.f64) {
      // todo
      //asm.mov(xmm0, rbx, null, 0)
    } else {
//      asm.movabs(Math.pow(2, 31), rax)
      asm.movdest(rax, rbx, 0)
    }
  }
  if (size > 0) asm.add(rsp, size)
  asm.pop(rbx)
  asm.ret()
  return compiler.compile(asm.bytes())
}

function compile_fastcall (address, result, params) {
  asm.reset()
  let size = stack_size(params)
  let caller_off = size + 8
  let stack_off = 0
  // if we don't have any arguments and the return does not need to be 
  // unwrapped then we can just let v8 call the target directly
  if (params.length === 0 && !needs_unwrap(result)) return address
  if (size > 0) {
    asm.sub(rsp, size)
  }
  for (let i = 0; i < Math.min(params.length, max_args); i++) {
    if (i === 0) {
      if (params[i] === Types.buffer || params[i] === Types.u32array) {
        asm.movsrc(rsi, rdi, 8)
      } else if (params[i] === Types.string) {
        asm.movsrc(rsi, rdi, 0)
      } else {
        asm.movreg(rsi, rdi)
      }
    } else if (i === 1) {
      if (params[i] === Types.buffer || params[i] === Types.u32array) {
        asm.movsrc(rdx, rsi, 8)
      } else if (params[i] === Types.string) {
        asm.movsrc(rdx, rsi, 0)
      } else {
        asm.movreg(rdx, rsi)
      }
    } else if (i === 2) {
      if (params[i] === Types.buffer || params[i] === Types.u32array) {
        asm.movsrc(rcx, rdx, 8)
      } else if (params[i] === Types.string) {
        asm.movsrc(rcx, rdx, 0)
      } else {
        asm.movreg(rcx, rdx)
      }
    } else if (i === 3) {
      asm.movreg(r8, rcx)
    } else if (i === 4) {
      asm.movreg(r9, r8)
    } else if (i === 5) {
      asm.movsrc(rsp, r9, caller_off)
      caller_off += 8
    } else {
      asm.movsrc(rsp, rax, caller_off)
      asm.movdest(rax, rsp, stack_off)
      caller_off += 8
      stack_off += 8
    }
  }
  if (needs_unwrap(result)) {
    asm.movsrc(rsp, rax, caller_off)
    asm.movdest(rax, rsp, stack_off)
  }
  if (size > 0) {
    asm.call(address)
    asm.add(rsp, size)
    asm.ret()
  } else {
    asm.jmp(address)
  }
//  console.log(asm.src)
  return compiler.compile(asm.bytes())
}

function bindall (api, addr = 0) {
  const binding = {}
  for (const key of Object.keys(api)) {
    const { name, result, parameters } = api[key]
    binding[key] = bind(assert(dlsym(addr, name || key)), result, parameters)
  }
  return binding
}

function bind (address, res = 'void', params = [], slow = false, fast_address = 0, slow_address = 0) {
  const state = ptr(new Uint8Array(struct_fastcall_size))
  const dv = new DataView(state.buffer)
  const result = Types[res]
  params = params.map(n => Types[n])
  const maxParam = Math.min(params.length, max_args)
  //const slowcall_target = slow_address ? slow_address : compile_slowcall(address, result, params)
  //const fastcall_target = fast_address ? fast_address : compile_fastcall(address, result, params)
  const slowcall_target = slow_address ? slow_address : compile_slowcall(address, result, params)
  const slow_src = asm.src
  let fast_src
  if (!slow) {
    const fastcall_target = fast_address ? fast_address : compile_fastcall(address, result, params)
    // 0-7:   set the fastcall wrapper pointer to first 64-bit slot in state
    //        this slot is also used to receive result in %rax
    dv.setBigUint64(fastcall_pointer_off, BigInt(fastcall_target), true)
    fast_src = asm.src
  }
  // 8:     set return type
  dv.setUint8(return_type_off, result)
  // 9:     set length of params
  dv.setUint8(param_length_off, maxParam)
  // 10-39: set param types - max 30 params
  for (let i = 0; i < maxParam; i++) dv.setUint8(param_types_off + i, params[i])
  // 104:    set function call pointer to state->fn slot (for slowcall)
  dv.setBigUint64(slowcall_pointer_off, BigInt(slowcall_target), true)
  // todo: wrap here
  const generated_fun = slow ? bind_slowcall(state.ptr) : 
    bind_fastcall(state.ptr)
  // keep the state alive
  generated_fun._state = state
  generated_fun.slow_src = slow_src
  generated_fun.fast_src = fast_src
  return needs_unwrap(result) ? wrap(result_handle, generated_fun, 
    params.length) : generated_fun
}

const { rdi, rsi, rdx, rcx, r8, r9, rsp, rax, rbx } = Registers
// maximum number of args we can handle - this is arbitrary
const max_args = 30
// the offset in struct fastcall where we place the function pointer for the 
// generated fastcall wrapper
const fastcall_pointer_off = 0
// the offset in struct fastcall where we place the function pointer for the 
// generated slowcall wrapper
const slowcall_pointer_off = 40 + (32 * 8)
const return_type_off = 8
const param_length_off = 9
const param_types_off = 10
const result_handle = new Uint32Array(2)
const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18, string: 19
}

const asm = new Assembler()
const compiler = new Compiler()

export { bind, bindall }
