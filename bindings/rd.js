import { compiler } from 'lib/asm.js'
import { bind } from 'lib/ffi.js'

const bytes = new Uint8Array([
  // rdtsc
  0x0f, 0x31, 
  // shl $0x20, %rdx
  0x48, 0xc1, 0xe2, 0x20, 
  // or %rdx, %rax
  0x48, 0x09, 0xd0, 
  // ret
  0xc3
])

const address = compiler.compile(bytes)
const rdtsc = bind(address, 'u32', [])

let last = rdtsc()
let max = last
let min = last
let total = 1
let avg = 0
let all = 0

for (let i = 1; i < 1000000; i++) {
  const current = rdtsc()
  total += 1
  const diff = current - last
  if (diff > max) {
    max = diff
  } else if (diff < min) {
    min = diff
  }
  all += diff
  avg = all / total
  last = current
}

console.log(total)
console.log(max)
console.log(min)
console.log(avg)


const runs = 200000000

while (1) {
  const start = Date.now()
  for (let i = 0; i < runs; i++) rdtsc()
  const elapsed = Date.now() - start
  const rate = Math.floor(runs / (elapsed / 1000))
  const ns_iter = Math.floor((elapsed * 1000000) / runs)
  console.log(`rate ${rate} ns_iter ${ns_iter}`)
}
