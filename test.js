import { Assembler, Compiler, Registers } from 'lib/asm.js'
import { bind } from 'lib/ffi.js'
import { Bench } from 'lib/bench.js'

const { rax, rdi, rsi } = Registers

const asm = new Assembler()
const compiler = new Compiler()

function copy_8_asm () {
  asm.reset()
  asm.movabs(srcb.ptr, rdi)
  asm.movabs(dest.ptr, rsi)
  asm.movsrc(rdi, rax, 0)
  asm.movdest(rax, rsi, 0)
  asm.movabs(8, rax)
  asm.ret()
  return asm.bytes()
}


const src = '01234567'

const encoder = new TextEncoder()
const srcb = lo.ptr(encoder.encode(src))
const dest = lo.ptr(new Uint8Array(16))

const addr = compiler.compile(copy_8_asm())
const copy_8 = bind(addr, 'i32', [])

const iter = 10
const bench = new Bench()
const size = 8
const count = 256 * 1024 * 1024

console.log(srcb)
console.log(dest)
assert(copy_8() === size)
console.log(dest)
srcb.fill(1)
console.log(srcb)
console.log(dest)
assert(copy_8() === size)
console.log(dest)


for (let i = 0; i < iter; i++) {
  bench.start(`write_ascii_string ${size}`)
  for (let j = 0; j < count; j++) {
    assert(copy_8() === size)
  }
  bench.end(count, size)
}
