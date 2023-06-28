import { compile } from 'lib/compiler.js'
import { dump } from 'lib/binary.js'
import { run } from 'lib/bench.js'

const { ptr } = spin
const { fastcall, bind_fastcall } = spin.load('fast').fast

const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18, string: 19
}

const state = ptr(new Uint8Array(8 + 32 + (16 * 8) + (16 * 8) + 8))
const dv = new DataView(state.buffer)

const fncode = ptr(new Uint8Array([
  //push %rbx
  0x53,
  //movq  %rdi, %rbx      # move first arg (addr of the "stack" to %rbx)
  0x48, 0x89, 0xfb,
  //movq  8(%rbx), %rdi
  0x48, 0x8b, 0x7b, 0x08,
  //movq  16(%rbx), %rsi
  0x48, 0x8b, 0x73, 0x10,
  //movq  24(%rbx), %rdx
  0x48, 0x8b, 0x53, 0x18,
  //call  *80(%rbx)       # call the function in rbx from "stack"
  0xff, 0x53, 0x50,
  //movq  %rax, (%rbx)    # set the rax address in "stack" to return value
  0x48, 0x89, 0x03,
  //pop %rbx
  0x5b,
  //ret
  0xc3
]))
const fn = compile(fncode)

const strlen_addr = spin.dlsym(0, 'strnlen')
spin.assert(strlen_addr)

const wrappercode = ptr(new Uint8Array([
  //mov    %rsi,%rdi
  0x48, 0x89, 0xf7,
  //mov    %edx,%esi
  0x89, 0xd6,
  //movabs {fn address},%rax
  0x48, 0xb8, ...Array.from(new Uint8Array((new BigUint64Array([BigInt(strlen_addr)])).buffer)),
  // call  *%rax
  0xff, 0xd0,
  //ret
  0xc3
]))

const wrapper = compile(wrappercode)

dv.setBigUint64(0, BigInt(wrapper), true)
dv.setUint8(8, Types.i32)
dv.setUint8(9, 2)
dv.setUint8(10, Types.pointer)
dv.setUint8(11, Types.u32)
dv.setBigUint64(40 + (8 * 8), BigInt(fn), true)
dv.setBigUint64(40 + (10 * 8), BigInt(strlen_addr), true)
//dv.setBigUint64(40, BigInt(syscall_nr), true)

const str = spin.cstr('hello')
const strptr = str.ptr
dv.setBigUint64(40 + (1 * 8), BigInt(strptr), true)
dv.setBigUint64(40 + (2 * 8), BigInt(1024), true)

const strnlen = bind_fastcall(state.ptr)
const foo = () => strnlen(strptr, 1024)
spin.assert(foo() === 5)
spin.assert(dv.getInt32(40, true) === 5)

run('binding', () => strnlen(strptr, 1024), 200000000, 10)
//run('direct', () => fastcall(state.ptr), 200000000, 10)

spin.assert(foo() === 5)
spin.assert(dv.getInt32(40, true) === 5)
spin.assert(strnlen(strptr, 1024) === 5)
