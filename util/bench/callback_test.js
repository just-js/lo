import { Assembler, address_as_bytes } from 'lib/asm.js'
import { bind } from 'lib/fast.js'
import { mem } from 'lib/bench.js'

const { dlopen, dlsym, ptr, registerCallback, assert } = spin

// gcc -fPIC -O3 -s -shared -march=native -mtune=native -o callback.so callback.c

const asm = new Assembler()

const handle = dlopen('./callback.so', 1)
const register_callback = bind(dlsym(handle, 'register_callback'), 'void', ['pointer'])
const call_callback = bind(dlsym(handle, 'call_callback'), 'void', ['u32'], true)

const nArgs = 1
const ctx = ptr(new Uint8Array(((nArgs + 3) * 8)))
const u32 = new Uint32Array(ctx.buffer)

function fn (counter) {
  return counter + 1
}

function callback () {
  u32[4] = fn(u32[6])
}

/*
this is 82ns per callback
doing it native is 74
*/

const callback_address = dlsym(0, 'spin_callback')
assert(callback_address)
registerCallback(ctx.ptr, callback)

const code_buf = ptr(new Uint8Array([
  // movabs (address of context), %rax
  0x48, 0xb8, ...address_as_bytes(ctx.ptr),
  // mov %rdi, 24(%rax)
  0x48, 0x89, 0x78, 0x18,
  // mov %rax, %rdi
  0x48, 0x89, 0xc7,
  // mov %rax, %r15
  0x49, 0x89, 0xc7,
  // call {callback_address}
  ...asm.reset().call(callback_address).bytes(),
  // mov 16(%r15), %rax
  0x49, 0x8b, 0x47, 0x10,
  // ret
  0xc3
]))

const wrapper = asm.compile(code_buf)
register_callback(wrapper)

const runs = 40000000

while (1) {
  const start = spin.hrtime()
  call_callback(runs)
  const elapsed = (spin.hrtime() - start)
  const rate = Math.floor(runs / (elapsed / 1e9))
  const ns_iter = Math.floor(elapsed / runs)
  console.log(`time ${elapsed.toFixed(2)} rss ${mem()} rate ${rate} ns/iter ${ns_iter}`)
}
