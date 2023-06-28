import { system } from 'lib/system.js'

const { mprotect, memcpy } = system
const { assert, addr } = spin

const PROT_READ = 1
const MAP_PRIVATE = 2
const PROT_WRITE = 2
const PROT_EXEC = 4
const MAP_ANONYMOUS = 0x20

const mmap = spin.wrap2(system.mmap, 6)

function compile (code) {
  const u32 = new Uint32Array(2)
  const address = mmap(0, code.length, PROT_WRITE | PROT_EXEC, MAP_ANONYMOUS | MAP_PRIVATE, -1, 0, u32)  
  assert(address)
  memcpy(address, code.ptr, code.length, u32)
  assert(addr(u32) === address)
  assert(mprotect(address, code.length, PROT_EXEC | PROT_READ) === 0)
  return address
}

export { compile }
