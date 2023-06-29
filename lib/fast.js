import { system } from 'lib/system.js'

const { fastcall, bind_fastcall } = spin.load('fast').fast
const { mprotect, memcpy } = system
const { assert, addr, ptr } = spin

const mmap = spin.wrap2(system.mmap, 6)

const PROT_READ = 1
const MAP_PRIVATE = 2
const PROT_WRITE = 2
const PROT_EXEC = 4
const MAP_ANONYMOUS = 0x20
const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18, string: 19
}

function compile (code) {
  const u32 = new Uint32Array(2)
  const address = mmap(0, code.length, PROT_WRITE | PROT_EXEC, 
    MAP_ANONYMOUS | MAP_PRIVATE, -1, 0, u32)  
  assert(address)
  memcpy(address, code.ptr, code.length, u32)
  assert(addr(u32) === address)
  assert(mprotect(address, code.length, PROT_EXEC | PROT_READ) === 0)
  return address
}

function address_as_bytes (address) {
  return Array.from(new Uint8Array((new BigUint64Array([
    BigInt(address)
  ])).buffer))
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

const arg_instr = [
  [
    // movq  8(%rbx), %rdi
    [0x48, 0x8b, 0x7b, 0x08],
  ],
  [
    // movq  16(%rbx), %rsi
    [0x48, 0x8b, 0x73, 0x10],
  ],
  [
    // movq  24(%rbx), %rdx
    [0x48, 0x8b, 0x53, 0x18],
  ],
  [
    // movq  32(%rbx), %rcx
    [0x48, 0x8b, 0x4b, 0x20],
  ],
  [
    // movq  40(%rbx), %r8
    [0x4c, 0x8b, 0x43, 0x28],
  ],
  [
    // movq  48(%rbx), %r9
    [0x4c, 0x8b, 0x4b, 0x30],
  ],
]

const shift_instr = [
  [
    // movq    %rsi, %rdi
    [0x48, 0x89, 0xf7],
    // movq    8(%rsi), %rdi
    [0x48, 0x8b, 0x7e, 0x08]
  ],
  [
    // movq    %rdx, %rsi
    [0x48, 0x89, 0xd6],
    // movq    8(%rdx), %rsi
    [0x48, 0x8b, 0x72, 0x08]
  ],
  [
    // movq    %rcx, %rdx
    [0x48, 0x89, 0xca],
    // movq    8(%rcx), %rdx
    [0x48, 0x8b, 0x51, 0x08]
  ],
  [
    // movq    %r8, %rcx
    [0x4c, 0x89, 0xc1],
    // movq    8(%r8), %rcx
    [0x49, 0x8b, 0x48, 0x08]
  ],
  [
    // movq    %r9, %r8
    [0x4d, 0x89, 0xc8],
    // movq    8(%r9), %r8
    [0x4d, 0x8b, 0x41, 0x08]
  ],
  [
    // movq    (%rsp), %r9
    [0x4c, 0x8b, 0x0c, 0x24],
    [
      // movq    (%rsp), %r9
      0x4c, 0x8b, 0x0c, 0x24, 
      // movq    8(%r9), %r9
      0x4d, 0x8b, 0x49, 0x08
    ],
  ],
]

class Compiler {
  #codes = []

  load () {
    // movq  %rdi, %rbx
    this.#codes.push([0x48, 0x89, 0xfb])
  }

  push () {
    // push %rbx
    this.#codes.push(0x53)
  }

  pop () {
    // pop %rbx
    this.#codes.push(0x5b)
  }

  arg (type, index) {
    switch (type) {
      default:
        const instr = arg_instr[index][0]
        if (instr) this.#codes.push(instr)
        break
    }
  }

  call (address) {
    // movabs {fn address}, %rax
    this.#codes.push([0x48, 0xb8, ...address_as_bytes(address)])
    // call  *%rax
    this.#codes.push([0xff, 0xd0])
  }

  result () {
    // movq  %rax, (%rbx)
    this.#codes.push([0x48, 0x89, 0x03])    
  }

  return () {
    // ret
    this.#codes.push(0xc3)
  }

  reset () {
    this.#codes.length = 0
  }

  out () {
    return ptr(new Uint8Array(this.#codes.flat()))
  }

  shiftarg (type, index) {
    switch (type) {
      case Types.buffer:
      case Types.u32array:
        this.#codes.push(shift_instr[index][1])
        break
      default:
        this.#codes.push(shift_instr[index][0])
        break
    }
  }
}

function compile_function_call (address, result, params) {
  compiler.reset()
  if (params.length > 0 || result !== Types.void) {
    compiler.push()
    compiler.load()
  }
  for (let i = 0; i < Math.min(params.length, 6); i++) compiler.arg(params[i], i)
  compiler.call(address)
  if (result !== Types.void) compiler.result()
  if (params.length > 0 || result !== Types.void) compiler.pop()
  compiler.return()
  return compile(compiler.out())
}

function compile_fastcall_wrapper (address, result, params) {
  compiler.reset()
  for (let i = 0; i < params.length; i++) {
    compiler.shiftarg(params[i], i)
  }
  if (needs_unwrap(result)) {
    compiler.shiftarg(Types.u32array, params.length)
  }
  compiler.call(address)
  compiler.return()
  return compile(compiler.out())
}

function bind (address, res, par) {
  const state = ptr(new Uint8Array(8 + 32 + (16 * 8) + (16 * 8) + 8))
  const dv = new DataView(state.buffer)
  const result = Types[res]
  const params = par.map(n => Types[n])
  const maxParam = Math.min(params.length, 30)
  const fn = compile_function_call(address, result, params)
  const wrapper = compile_fastcall_wrapper(address, result, params)
  // 0-7:   set the fastcall wrapper pointer to first 64-bit slot in state
  dv.setBigUint64(0, BigInt(wrapper), true)
  // 8:     set return type
  dv.setUint8(8, result)
  // 9:     set length of params
  dv.setUint8(9, params.length)
  // 10-39: set param types - max 30 params
  for (let i = 0; i < maxParam; i++) dv.setUint8(10 + i, params[i])
  // 104:    set function call pointer to %rsp(1) slot (for slowcall)
  dv.setBigUint64(40 + (8 * 8), BigInt(fn), true)
  const foo = bind_fastcall(state.ptr)
  foo.state = state
  return foo
}

const compiler = new Compiler()

export { bind, fastcall }
