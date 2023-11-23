// todo: use 32 bit and 16 bit ops where possible and measure the difference
const { mprotect, memcpy, mmap } = lo.core
const { assert, addr, ptr } = lo

const Registers = {
  rax: 'rax', rbx: 'rbx', rcx: 'rcx', rdx: 'rdx', rsi: 'rsi', rdi: 'rdi',
  rbp: 'rbp', rsp: 'rsp', r8: 'r8', r9: 'r9', r10: 'r10', r11: 'r11',
  r12: 'r12', r13: 'r13', r14: 'r14', r15: 'r15'
}

const {
  rax, rbx, rcx, rdx, rsi, rdi, rbp, rsp, r8, r9, r10
} = Registers

const PROT_READ = 1
const MAP_PRIVATE = 2
const PROT_WRITE = 2
const PROT_EXEC = 4
const MAP_ANONYMOUS = 0x20

const u32 = new Uint32Array(2)

function compile (code) {
  const address = mmap(0, code.length, PROT_WRITE, MAP_ANONYMOUS | MAP_PRIVATE, 
    -1, u32)
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

class Assembler {
  #codes = []
  #instrns = []

  push (reg) {
    this.#instrns.push(`push %${reg}`)
    if (reg === rbx) {
      this.#codes.push(0x53)
      return
    }
  }

  pop (reg) {
    this.#instrns.push(`pop %${reg}`)
    if (reg === rbx) {
      this.#codes.push(0x5b)
      return
    }
  }

  sub (reg, bytes) {
    this.#instrns.push(`sub $${bytes}, %${reg}`)
    if (reg === rsp) {
      this.#codes.push([0x48, 0x83, 0xec, bytes])
      return
    }
  }

  add (reg, bytes) {
    this.#instrns.push(`add $${bytes}, %${reg}`)
    if (reg === rsp) {
      this.#codes.push([0x48, 0x83, 0xc4, bytes])
      return
    }
  }

  call (address) {
    // todo: can we use a direct call here if we can calculate the relative
    // address of the function being called.
    this.#instrns.push(`movabs ${address}, %rax`)
    this.#codes.push([0x48, 0xb8, ...address_as_bytes(address)])
    this.#instrns.push('call  *%rax')
    this.#codes.push([0xff, 0xd0])
    return this
  }

  jmp (address) {
    this.#instrns.push(`movabs ${address}, %rax`)
    this.#codes.push([0x48, 0xb8, ...address_as_bytes(address)])
    this.#instrns.push('jmp  *%rax')
    this.#codes.push([0xff, 0xe0])
    return this
  }

  mov (src, dest, soff = null, doff = null) {
    if (soff === null && doff === null) {
      this.#instrns.push(`mov %${src}, %${dest}`)
      if (src === rdi && dest === rbx) {
        this.#codes.push([0x48, 0x89, 0xfb])
        return
      }
      if (src === rsi && dest === rdi) {
        this.#codes.push([0x48, 0x89, 0xf7])
        return
      }
      if (src === rdx && dest === rsi) {
        this.#codes.push([0x48, 0x89, 0xd6])
        return
      }
      if (src === rcx && dest === rdx) {
        this.#codes.push([0x48, 0x89, 0xca])
        return
      }
      if (src === r8 && dest === rcx) {
        this.#codes.push([0x4c, 0x89, 0xc1])
        return
      }
      if (src === r9 && dest === r8) {
        this.#codes.push([0x4d, 0x89, 0xc8])
        return
      }
      if (dest === rax) {
        this.#codes.push([0x48, 0xc7, 0xc0, src, 0, 0, 0])
        return
      }
      if (dest === rdi) {
        this.#codes.push([0x48, 0xc7, 0xc7, src & 0xff, (src >> 8) * 0xff, 
          (src >> 16) & 0xff, (src >> 24) & 0xff])
        return
      }
      console.log('unsupported')
      return
    }
    if (soff === null && doff !== null) {
      if (doff) {
        console.log('unsupported')
      } else {
        this.#instrns.push(`mov %${src}, (%${dest})`)
        if (src === rax && dest === rbx) {
          this.#codes.push([0x48, 0x89, 0x03])
        }
      }
      return
    }
    if (soff !== null && doff === null) {
      if (soff) {
        this.#instrns.push(`mov ${soff}(%${src}), %${dest}`)
        if (src === rbx && dest === rdi) {
          this.#codes.push([0x48, 0x8b, 0x7b, soff])
        } else if (src === rbx && dest === rsi) {
          this.#codes.push([0x48, 0x8b, 0x73, soff])
        } else if (src === rbx && dest === rdi) {
          this.#codes.push([0x48, 0x8b, 0x7b, soff])
        } else if (src === rbx && dest === rdx) {
          this.#codes.push([0x48, 0x8b, 0x53, soff])
        } else if (src === rbx && dest === rcx) {
          this.#codes.push([0x48, 0x8b, 0x4b, soff])
        } else if (src === rbx && dest === r8) {
          this.#codes.push([0x4c, 0x8b, 0x43, soff])
        } else if (src === rbx && dest === r9) {
          this.#codes.push([0x4c, 0x8b, 0x4b, soff])
        } else if (src === rsp && dest === r9) {
          if (soff >= 0x80) {
            this.#codes.push([0x4c, 0x8b, 0x8c, 0x24, soff, 0x00, 0x00, 0x00])
          } else {
            this.#codes.push([0x4c, 0x8b, 0x4c, 0x24, soff])
          }
        } else if (src === rsi && dest === rdi) {
          this.#codes.push([0x48, 0x8b, 0x7e, soff])
        } else if (src === rdx && dest === rsi) {
          this.#codes.push([0x48, 0x8b, 0x72, soff])
        } else if (src === rcx && dest === rdx) {
          this.#codes.push([0x48, 0x8b, 0x51, soff])
        } else {
          console.log('unsupported')
        }
      } else {
        this.#instrns.push(`mov (%${src}), %${dest}`)
        if (src === rsi && dest === rdi) {
          this.#codes.push([0x48, 0x8b, 0x3e])
        } else if (src === rdx && dest === rsi) {
          this.#codes.push([0x48, 0x8b, 0x32])
        } else if (src === rcx && dest === rdx) {
          this.#codes.push([0x48, 0x8b, 0x11])
        } else {
          console.log('unsupported')
        }
      }
      return
    }
    if (soff !== null && doff !== null) {
      if (soff) {
        if (doff) {
          this.#instrns.push(`mov ${soff}(%${src}), %rax`)
          this.#instrns.push(`mov %rax, ${doff}(%${dest})`)
          if (src === rsp && dest === rsp) {
            if (soff >= 0x80) {
              this.#codes.push([0x48, 0x8b, 0x84, 0x24, soff, 0x00, 0x00, 0x00])
            } else {
              this.#codes.push([0x48, 0x8b, 0x44, 0x24, soff])
            }
            this.#codes.push([0x48, 0x89, 0x44, 0x24, doff])
          } else if (src === rbx && dest === rsp) {
            if (soff >= 0x80) {
              this.#codes.push([0x48, 0x8b, 0x83, soff, 0x00, 0x00, 0x00])
            } else {
              this.#codes.push([0x48, 0x8b, 0x43, soff])
            }
            this.#codes.push([0x48, 0x89, 0x44, 0x24, doff])
          } else {
            console.log('not supported')
          }
        } else {
          this.#instrns.push(`mov ${soff}(%${src}), %rax`)
          this.#instrns.push(`mov %rax, (%${dest})`)
          if (src === rsp && dest === rsp) {
            if (soff >= 0x80) {
              this.#codes.push([0x48, 0x8b, 0x84, 0x24, soff, 0x00, 0x00, 0x00])
            } else {
              this.#codes.push([0x48, 0x8b, 0x44, 0x24, soff])
            }
            this.#codes.push([0x48, 0x89, 0x04, 0x24])
          } else if (src === rbx && dest === rsp) {
            if (soff >= 0x80) {
              this.#codes.push([0x48, 0x8b, 0x83, soff, 0x00, 0x00, 0x00])
            } else {
              this.#codes.push([0x48, 0x8b, 0x43, soff])
            }
            this.#codes.push([0x48, 0x89, 0x04, 0x24])
          } else {
            console.log('not supported')
          }
        }
      } else {
        if (doff) {
          console.log('not supported')
        } else {
          this.#instrns.push(`mov (%${src}), %rax`)
          this.#instrns.push(`mov %rax, (%${dest})`)
          if (src === rax && dest === rbx) {
            this.#codes.push([0x48, 0x89, 0x03])
          } else {
            console.log('not supported')
          }
        }
      }
    }
  }

  ret () {
    this.#instrns.push('ret')
    this.#codes.push(0xc3)
  }

  reset () {
    this.#instrns.length = this.#codes.length = 0
    return this
  }

  src () {
    return this.#instrns.flat().join('\n')
  }

  codes () {
    return this.#codes.map(c => c.length ? c.map(cc => cc.toString(16)) : 
      c.toString(16)).join('\n')
  }

  bytes () {
    return ptr(new Uint8Array(this.#codes.flat())) 
  }

  compile (bytes = this.bytes()) {
    return compile(bytes)
  }

  // todo: deallocate/free the code memory - what happens when it gets gc'd?
}

export { Assembler, Registers, compile, address_as_bytes }
