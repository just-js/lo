const { assert, addr, ptr, core } = lo

const {
  mprotect, memcpy, mmap,
  PROT_READ, MAP_PRIVATE, PROT_WRITE, PROT_EXEC, MAP_ANONYMOUS
} = core

const u32 = new Uint32Array(2)

/*

TODO

- keep track of code sections with naming so they can be freed up later
- is there any way to make this safe?
- we should allow disabling it

https://gist.github.com/huntergregal/cb7066438f0155c4951c24a284885911
*/

const flags = MAP_ANONYMOUS | MAP_PRIVATE

class Compiler {
  compile (code) {
    // todo: try/catch and unmap memory if mapped
    if (!code.ptr) ptr(code)
    const address = mmap(0, code.length, PROT_WRITE, flags, 
      -1, u32)
    assert(address)
    assert(memcpy(address, code.ptr, code.length) === address)
    assert(mprotect(address, code.length, PROT_EXEC | PROT_READ) === 0)
    return address
  }
}

export { Compiler }
