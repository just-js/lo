const { ffi_call, ffi_syscall } = spin.load('spin').spin

/*
https://github.com/torvalds/linux/blob/v5.0/arch/x86/entry/entry_64.S#L107
https://github.com/torvalds/linux/blob/master/arch/x86/entry/syscalls/syscall_64.tbl
https://lxr.linux.no/linux+v3.2/arch/x86/include/asm/unistd_64.h
https://blog.rchapman.org/posts/Linux_System_Call_Table_for_x86_64/
https://wiki.cdot.senecacollege.ca/wiki/SPO600_64-bit_Assembly_Language_Lab
https://gaultier.github.io/blog/x11_x64.html
*/

/*
layout of state is just an array of 64 bit integer "cells"
0  - 15 (16)        = gp registers (in order as above)
16 - 47 (32)        = sse registers (2 cells for each - 128 bit registers)
48 - 51 (4)         = stack start
52 - ?  (nargs - 6) = stack values
*/

/* ffi_call.S
.type spin_ffi_call, @function
.global spin_ffi_call

spin_ffi_call:
  movq  %rdi, %r10      # move first arg (addr of the "stack" to reg r10)
  movq  8(%r10), %rdi
  movl  16(%r10), %esi
  movq  24(%r10), %rdx
  movq  32(%r10), %rcx
  movq  40(%r10), %r8
  movq  48(%r10), %r9
#  movq  56(%r10), %rax
#  movq  %rax, (%rsp)
#  movq  64(%r10), %rax
#  movq  %rax, 8(%rsp)
  call  *64(%r10)       # call the function in rbx from "stack"
  movq  %rax, (%r10)    # set the rax address in "stack" to return value
  ret
*/

const gp = [      // general purpose registers (64 bit), (P) = preserve
  'rax',          // register a extended (out: return value, in: syscall_nr / 0)
  'rdi',          // register destination index                      (arg 1)
  'rsi',          // register source index                           (arg 2)
  'rdx',          // register d extended                             (arg 3)
  'rcx',          // register c extended                             (arg 4)
  'r8',           // register 8                                      (arg 5)
  'r9',           // register 9                                      (arg 6)
  'rsp',          // register stack pointer (all other args on stack)    (P)
  'rbx',          // register b extended                                 (P)
  'rbp',          // register base pointer (base of stack)               (P)
  'r10',          // register 10
  'r11',          // register 11
  'r12',          // register 12                                         (P)
  'r13',          // register 13                                         (P)
  'r14',          // register 14                                         (P)
  'r15',          // register 15                                         (P)
]

const sse = [     // sse registers (128 bit)
  'xmm0', 'xmm1', 'xmm2',  'xmm3',  'xmm4',  'xmm5',  'xmm6',  'xmm7',
  'xmm8', 'xmm9', 'xmm10', 'xmm11', 'xmm12', 'xmm13', 'xmm14', 'xmm15' 
]

const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18, string: 19
}

function gen_js (rtype, params, opts = {}) {
  const { safe64 = false } = opts
  const source = []
  if (safe64) source.push('  const is_safe_integer = Number.isSafeInteger')
  source.push(`function f (${params.map((v, i) => `arg${i}`).join(', ')}) {`)
  if (opts.syscall) {
    source.push(`  rdv.setInt32(0, ${opts.syscall_nr}, true)`)
  }
  for (let i = 0; i < params.length; i++) {
    const off = (i + 1) * 8
    switch (params[i]) {
      case Types.function:
        break
      case Types.buffer:
      case Types.u32array:
        source.push(`  const addr = spin.getAddress(arg${i})`)
        source.push(`  rdv.setUint32(${off}, addr & 0xffffffff, true)`)
        source.push(`  rdv.setUint32(${off + 4}, Math.floor(addr / (2 ** 32)), true)`)
        break
      case Types.i64:
      case Types.iSize:
        break
      case Types.string:
        break
      case Types.u64:
      case Types.uSize:
      case Types.pointer:
        source.push(`  rdv.setUint32(${off}, arg${i} & 0xffffffff, true)`)
        source.push(`  rdv.setUint32(${off + 4}, Math.floor(arg${i} / (2 ** 32)), true)`)
        break
      case Types.f64:
        break
      case Types.i32:
        source.push(`  rdv.setInt32(${off}, arg${i}, true);`)
        break
      case Types.u32:
        source.push(`  rdv.setUint32(${off}, arg${i}, true);`)
        break
      case Types.u8:
        source.push(`  rdv.setUint8(${off}, arg${i}, true);`)
        break
      case Types.i8:
        source.push(`  rdv.setInt8(${off}, arg${i}, true);`)
        break
      case Types.u16:
        source.push(`  rdv.setUint16(${off}, arg${i}, true);`)
        break
      case Types.i16:
        source.push(`  rdv.setInt16(${off}, arg${i}, true);`)
        break
    }
  }
  source.push('  ffi_call(ptr)')
  switch (rtype) {
    case Types.u64:
    case Types.pointer:
    case Types.uSize:
      // (2 ^ 53) - 1 is the max safe JS number
      if (safe64) {
        source.push('  const n = rdv.getUint32(0, true) + ((2 ** 32) * rdv.getUint32(4, true))')
        source.push('  if (is_safe_integer(n)) return n')
        source.push('  return rdv.getBigUint64(0, true)')
      } else {
        source.push('  return rdv.getUint32(0, true) + ((2 ** 32) * rdv.getUint32(4, true))')
      }
      break;
    case Types.u32:
      source.push('  return rdv.getUint32(0, true)')
      break;
    case Types.u16:
      source.push('  return rdv.getUint16(0, true)')
      break;
    case Types.u8:
      source.push('  return rdv.getUint8(0, true)')
      break;
    case Types.i8:
      source.push('  return rdv.getInt8(0, true)')
      break;
    case Types.i16:
      source.push('  return rdv.getInt16(0, true)')
      break;
    case Types.i32:
      source.push('  return rdv.getInt32(0, true)')
      break;
  }
  source.push('}')
  source.push('return f')
  const src = source.join('\n').trim()
  //console.log(src)
  return src
}

const maxregs = 6 // maximum registers used in a function call
const maxsse = 8  // max numberof sse registers in a function call
const default_stack_size = 4 * 8

function state_size (stack_size = 0) {
  return (8 + (stack_size * 8) + default_stack_size) + (gp.length * 8) + (maxsse * 16)
}

function create_function (fp, rtype, params, opts = {}) {
  const stack_size = (params.length - maxregs)
  const size = state_size(stack_size)
  const state = spin.ptr(new Uint8Array(size))
  const cells = new BigUint64Array(state.buffer)
  const rdv = new DataView(state.buffer)
  cells[8] = BigInt(fp)
  cells[7] = BigInt(state.ptr + (size - ((stack_size * 8) + default_stack_size)))
  const f = new Function('rdv', 'ffi_call', 'ptr', gen_js(Types[rtype], params.map(t => Types[t]), opts))
  return { state, fn: f(rdv, ffi_call, state.ptr) }
}

function create_syscall (syscall_nr, rtype, params, opts = {}) {
  const stack_size = (params.length - maxregs)
  //const size = state_size(stack_size)
  const slots = 4 + 16 + (16 * 2)
  const size = slots * 8
  const state = spin.ptr(new Uint8Array(size))
  const cells = new BigUint64Array(state.buffer)
  const rdv = new DataView(state.buffer)
  opts.syscall = true
  opts.syscall_nr = syscall_nr
  cells[7] = BigInt(state.ptr + state.length - 8)
  //cells[7] = BigInt(state.ptr + (size - ((stack_size * 8) + default_stack_size)))
  const f = new Function('rdv', 'ffi_call', 'ptr', gen_js(Types[rtype], params.map(t => Types[t]), opts))
  const fn = f(rdv, ffi_syscall, state.ptr)
  fn.state = state
  return { state, fn }
}

const { AG, AD, AM } = spin.colors

function dumpcpu (state) {
  const cells = new BigUint64Array(state.buffer)
  let i = 0
  console.log(`${AG}General Purpose Registers${AD}`)
  for (const reg of gp) {
    console.log(`${AM}${reg.padEnd(6, ' ')}${AD}: ${cells[i++]}`)
  }
  let rsp = Number(cells[7])
  i = (rsp - state.ptr) / 8
  while (rsp > state.ptr + ((16 + (16 * 2)) * 8)) {
    console.log(`${AM}${(i.toString()).padEnd(6, ' ')}${AD}: ${cells[i]}`)
    i--
    rsp -= 8
  }
}

export { create_function, dumpcpu, create_syscall }
