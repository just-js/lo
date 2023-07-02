import { system } from 'lib/system.js'

const { fastcall, bind_fastcall } = spin.load('fast').fast
const { mprotect, memcpy, mmap } = system
const { assert, addr, ptr } = spin

const maxArgs = 30 // we could increase this if we want to
// todo: allow setting syscall number
// todo: allow setting register for variable number of args functions
// todo: handling callback functions
// todo: handling floats / non integer register numbers
// todo: handling structs and bigger values on the stack
// todo: relocation? is it necessary? need to understand


/*
Each system call has a unique number. To perform it
1. The rax register has to hold system call’s number;
2. The following registers should hold its arguments: rdi, rsi, rdx, r10, r8, and r9.
System call cannot accept more than six arguments.

Note, that the syscall instruction changes rcx and r11!



*/

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
  [
    [
      // movq  56(%rbx), %rax
      0x48, 0x8b, 0x43, 0x38,
      // movq  %rax, (%rsp)
      0x48, 0x89, 0x04, 0x24
    ]
  ],
  [
    [
      // movq  64(%rbx), %rax
      0x48, 0x8b, 0x43, 0x40,
      // movq  %rax, 8(%rsp)
      0x48, 0x89, 0x44, 0x24, 0x08
    ]
  ],
  [
    [
      // movq  72(%rbx), %rax
      0x48, 0x8b, 0x43, 0x48,
      // movq  %rax, 16(%rsp)
      0x48, 0x89, 0x44, 0x24, 0x10
    ]
  ],
]

/*
AMD64 ABI
Section 3.2.1

Registers %rbp, %rbx and %r12 through %r15 “belong” to the calling function and 
the called function is required to preserve their values


*/

const shift_instr = [
  [
    // movq    %rsi, %rdi
    [0x48, 0x89, 0xf7],
    // movq    8(%rsi), %rdi # FastApiTypedArray - length prefixed
    [0x48, 0x8b, 0x7e, 0x08],
    // movq    (%rsi), %rdi # FastOneByteString - length suffixed
    [0x48, 0x8b, 0x3e]
  ],
  [
    // movq    %rdx, %rsi
    [0x48, 0x89, 0xd6],
    // movq    8(%rdx), %rsi
    [0x48, 0x8b, 0x72, 0x08],
    // movq    (%rdx), %rsi
    [0x48, 0x8b, 0x32],
  ],
  [
    // movq    %rcx, %rdx
    [0x48, 0x89, 0xca],
    // movq    8(%rcx), %rdx
    [0x48, 0x8b, 0x51, 0x08],
    // movq    (%rcx), %rdx
    [0x48, 0x8b, 0x11],
  ],
  [
    // movq    %r8, %rcx
    [0x4c, 0x89, 0xc1],
    // movq    8(%r8), %rcx
    [0x49, 0x8b, 0x48, 0x08],
    // movq    (%r8), %rcx
    [0x49, 0x8b, 0x08],
  ],
  [
    // movq    %r9, %r8
    [0x4d, 0x89, 0xc8],
    // movq    8(%r9), %r8
    [0x4d, 0x8b, 0x41, 0x08],
    // movq    (%r9), %r8
    [0x4d, 0x8b, 0x01],
  ],
  [
    // 6. movq    32(%rsp), %r9
    [0x4c, 0x8b, 0x4c, 0x24, 0x20],
    [
      // movq    (%rsp), %r9
      0x4c, 0x8b, 0x0c, 0x24, 
      // movq    8(%r9), %r9
      0x4d, 0x8b, 0x49, 0x08
    ],
    // movq    (%rsp), %r9
    [0x4c, 0x8b, 0x0c, 0x24],
  ],
  [
    [
      // movq  40(%rsp), %rax
      0x48, 0x8b, 0x44, 0x24, 0x28,
      // movq  %rax, (%rsp)
      0x48, 0x89, 0x04, 0x24
    ],
    [ // todo
      // movq    (%rsp), %r9
      0x4c, 0x8b, 0x0c, 0x24, 
      // movq    8(%r9), %r9
      0x4d, 0x8b, 0x49, 0x08
    ], // todo
    // movq    (%rsp), %r9
    [0x4c, 0x8b, 0x0c, 0x24],
  ],
  [
    [
      // movq  48(%rsp), %rax
      0x48, 0x8b, 0x44, 0x24, 0x30,
      // movq  %rax, 8(%rsp)
      0x48, 0x89, 0x44, 0x24, 0x08
    ],
    [ // todo
      // movq    (%rsp), %r9
      0x4c, 0x8b, 0x0c, 0x24, 
      // movq    8(%r9), %r9
      0x4d, 0x8b, 0x49, 0x08
    ], // todo
    // movq    (%rsp), %r9
    [0x4c, 0x8b, 0x0c, 0x24],
  ],
  [
    [
      // movq  56(%rsp), %rax
      0x48, 0x8b, 0x44, 0x24, 0x38,
      // movq  %rax, 16(%rsp)
      0x48, 0x89, 0x44, 0x24, 0x10
    ],
    [ // todo
      // movq    (%rsp), %r9
      0x4c, 0x8b, 0x0c, 0x24, 
      // movq    8(%r9), %r9
      0x4d, 0x8b, 0x49, 0x08
    ], // todo
    // movq    (%rsp), %r9
    [0x4c, 0x8b, 0x0c, 0x24],
  ],
]

class Compiler {
  #codes = []

  syscall (syscall_nr) {
    // set the syscall number in %rax for a SystemV syscall
    // movq  $syscall_nr, %rax - todo
    this.#codes.push([0x48, 0x89, 0xfb])
  }

  varargs (nargs) {
    // set the number of arguments for a varargs call
    // movq  $syscall_nr, %rax - todo
    this.#codes.push([0x48, 0x89, 0xfb])
  }

  add (size) {
    // add size, %rsp
    this.#codes.push([0x48, 0x83, 0xc4, ...address_as_bytes(size).slice(0, 1)])
  }

  sub (size) {
    // sub size, %rsp
    this.#codes.push([0x48, 0x83, 0xec, ...address_as_bytes(size).slice(0, 1)])
  }

  load () {
    // movq  %rdi, %rbx
    this.#codes.push([0x48, 0x89, 0xfb])
  }

  push () {
    // push %rbx
    this.#codes.push(0x53)
  }

  pushall () {
    // push %rbx, %rbp, %r12, %r13, %r14, r15
    this.#codes.push([
      0x53, 
      0x55,
      0x41, 0x54,
      0x41, 0x55,
      0x41, 0x56,
      0x41, 0x57
    ])
  }

  pop () {
    // pop %rbx
    this.#codes.push(0x5b)
  }

  popall () {
    // pop %rbx, %rbp, %r12, %r13, %r14, r15
    this.#codes.push([
      0x5b, 
      0x5d,
      0x41, 0x5c,
      0x41, 0x5d,
      0x41, 0x5e,
      0x41, 0x5f
    ])
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

  compile () {
    return compile(this.out())
  }

  shiftarg (type, index, stack_size = 0) {
    switch (type) {
      case Types.string:
        this.#codes.push(shift_instr[index][2])
        break
      case Types.buffer:
      case Types.u32array:
        this.#codes.push(shift_instr[index][1])
        break
      default:
        const instr = shift_instr[index][0].slice(0)
        if (index === 5 && stack_size === 8) {
          instr[instr.length - 1] -= 16
        }
        this.#codes.push(instr)
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
  const size = stack_size(result, params)
  if (size > 0) compiler.sub(size)
  for (let i = 0; i < Math.min(params.length, maxArgs); i++) {
    compiler.arg(params[i], i)
  }
  compiler.call(address)
  if (result !== Types.void) compiler.result()
  if (params.length > 0 || result !== Types.void) compiler.pop()
  if (size > 0) compiler.add(size)
  compiler.return()
  return compiler.compile()
}

function stack_size (result, params) {
  let n = Math.max(params.length - 6, 0)
  if (n % 2 > 0) n++
  return n * 8
}

function compile_fastcall_wrapper (address, result, params) {
  compiler.reset()
  //const size = stack_size(result, params) + 8
  const size = stack_size(result, params)
  if (size > 0) compiler.sub(size)
  for (let i = 0; i < Math.min(params.length, maxArgs); i++) {
    compiler.shiftarg(params[i], i, size)
  }
  if (needs_unwrap(result)) {
    compiler.shiftarg(Types.u32array, params.length, size)
  }
  compiler.call(address)
  if (size > 0) compiler.add(size)
  compiler.return()
  return compiler.compile()
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

const compiler = new Compiler()

export { bind, fastcall, Compiler, compile, Types, bind_fastcall }
