function bits_to_byte (b) {
  let shift = 8
  let d = 0
  let i = 0
  while(shift--) {
    d += (b[i++] << shift)
  }
  return d
}

function as_eight_bytes (address) {
  return Array.from(new Uint8Array((new BigUint64Array([
    BigInt(address)
  ])).buffer))
}

function as_four_bytes (address) {
  return Array.from(new Uint8Array((new Uint32Array([
    address
  ])).buffer))
}

// REX Prefix
function rex (w, r, x, b) {
  return bits_to_byte([0, 1, 0, 0, w, r, x, b])
}

/*
MOD.R/M Byte: 6-7 = MOD  3-5 = REG  0-2 = R/M
*/
function mod_rm (rm, reg = 0, mod = reg_direct) {
  return (rm % 8) + (reg << 3) + (mod << 6)
}

// 64 bit general purpose registers - we are only using these, not 32/16/8 ones
const gp64 = [
  'rax', 'rcx', 'rdx' , 'rbx', 'rsp', 'rbp', 'rsi', 'rdi', 'r8', 'r9', 'r10',
  'r11', 'r12', 'r13', 'r14', 'r15'
]

const gp = gp64.reduce((p, c, i) => {
  p[c] = i
  return p
}, {})

const Registers = gp64.reduce((p, c, i) => {
  p[c] = c
  return p
}, {})

const funny_registers = ['rbp', 'r13'] // todo?

// opcodes for required instructions
const op_push_r64 = 0x50
const op_pop_r64 = 0x58
const op_sub_r64 = 0x81
const op_sub_r64_rax = 0x2d
const op_sub_r64_1byte = 0x83
const op_add_r64_rax = 0x05
const op_call = 0xff
const op_mov_imm64 = 0xb8
const op_mov_reg_reg = 0x89
const op_mov_mem_reg = 0x8b
const op_mov_reg_mem = 0x89

// mod for mod/rm to use register direct addressing
const reg_direct = 0b11

/*

TOOD:

- bigint support
- checks - throw errors for invalid args
- figure out funny_registers
- figure out why we need to hard code param 0x24 in mov instrn
- can we do some kind of dynamic relocation? it should be possible if we
  keep track of all the addresses we are putting code in
- arm support - export correct assembler based on platform
  - should we just use x64 syntax and translate under the hood to arm?
    - we can probably get away with this with the limited subset of 
      instructions we support
    - alternatively we could come up with a standard naming for registers and
      instructions 
    - or we could just provide a higher level api that exposes methods to deal
      with everything using more "function oriented" 
- 32 and 16 bit operations
- floats
- simd/avx

See

Intel 64 and IA-32 Architectures Software Developers Manual

Volume2, Chapter 3, Section 3.1.1.1 - Opcode Column in the Instruction Summary Table

for descriptions of the fields in comments below

•NP — Indicates the use of 66/F2/F3 prefixes (beyond those already part of the instructions opcode) are not
allowed with the instruction. Such use will either cause an invalid-opcode exception (#UD) or result in the
encoding for a different instruction.

•NFx — Indicates the use of F2/F3 prefixes (beyond those already part of the instructions opcode) are not
allowed with the instruction. Such use will either cause an invalid-opcode exception (#UD) or result in the
encoding for a different instruction.

•REX.W — Indicates the use of a REX prefix that affects operand size or instruction semantics. The ordering of
the REX prefix and other optional/mandatory instruction prefixes are discussed Chapter 2. Note that REX
prefixes that promote legacy instructions to 64-bit behavior are not listed explicitly in the opcode column.

•/digit — A digit between 0 and 7 indicates that the ModR/M byte of the instruction uses only the r/m (register
or memory) operand. The reg field contains the digit that provides an extension to the instruction's opcode.

•/r — Indicates that the ModR/M byte of the instruction contains a register 
operand and an r/m operand. cb, cw, cd, cp, co, ct — A 1-byte (cb), 2-byte (cw), 
4-byte (cd), 6-byte (cp), 8-byte (co) or 10-byte (ct) value following the opcode. 
This value is used to specify a code offset and possibly a new value for the code 
segment register.

•ib, iw, id, io — A 1-byte (ib), 2-byte (iw), 4-byte (id) or 8-byte (io) immediate operand to the instruction that
follows the opcode, ModR/M bytes or scale-indexing bytes. The opcode determines if the operand is a signed
value. All words, doublewords, and quadwords are given with the low-order byte first.

•+rb, +rw, +rd, +ro — Indicated the lower 3 bits of the opcode byte is used to encode the register operand
without a modR/M byte. The instruction lists the corresponding hexadecimal value of the opcode byte with low
3 bits as 000b. In non-64-bit mode, a register code, from 0 through 7, is added to the hexadecimal value of the
opcode byte. In 64-bit mode, indicates the four bit field of REX.b and opcode[2:0] field encodes the register
operand of the instruction. “+ro” is applicable only in 64-bit mode. See Table 3-1 for the codes.

•+i — A number used in floating-point instructions when one of the operands is ST(i) from the FPU register stack.
The number i (which can range from 0 to 7) is added to the hexadecimal byte given at the left of the plus sign
to form a single opcode byte.

*/

class Assembler {
  #codes = []
  #instr = []

  #call_or_jmp (address, reg = 'rax', method = 'call') {
    const idx = gp[reg]
    this.movabs(address, reg)
    this.#instr.push(`${method} *%${reg}`)
    if (idx < 8) {
      this.#codes.push([op_call, mod_rm(idx, method === 'call' ? 2 : 4)])
    } else {
      this.#codes.push([rex(0, 0, 0, 1), op_call, mod_rm(idx, 
        method === 'call' ? 2 : 4)])
    }
  }

  #add_or_sub (reg, bytes, method = 'add') {
    const idx = gp[reg]
    this.#instr.push(`${method} $${bytes}, %${reg}`)
    const mod_ext = (method === 'add' ? 0 : 5)
    if (bytes < 128) {
      // OpCode:      REX.W + 83 /0 ib
      // Instruction: add r64, imm8
      // Op/En:       MI
      //              1: ModRM:r/m (r, w)
      //              2: imm8/16/32
      this.#codes.push([rex(1, 0, 0, idx < 8 ? 0 : 1), op_sub_r64_1byte, 
        mod_rm(idx, mod_ext), bytes])
      return
    }
    if (reg === 'rax') {
      // OpCode:      REX.W + 05 id
      // Instruction: add RAX, imm32  
      // Op/En:       I
      //              1: AL/AX/EAX/RAX
      //              2: imm8/16/32
      this.#codes.push([rex(1, 0, 0, idx < 8 ? 0 : 1), method === 'add' ? 
        op_add_r64_rax : op_sub_r64_rax, ...as_four_bytes(bytes)])
      return
    }
    // OpCode:      REX.W + 81 /0 id
    // Instruction: add r64, imm32
    // Op/En:       MI
    //              1: ModRM:r/m (r, w)
    //              2: imm8/16/32
    this.#codes.push([rex(1, 0, 0, idx < 8 ? 0 : 1), op_sub_r64, 
      mod_rm(idx, mod_ext), ...as_four_bytes(bytes)])
  }

  // Instruction: xor r64. r64
  zero (reg) {
    const idx = gp[reg]
    this.#instr.push(`xor %${reg}, %${reg}`)
    // todo
    if (reg === 'rax') {
      this.#codes.push([0x48, 0x31, 0xc0])
    } else if (reg === 'rdi') {
      this.#codes.push([0x48, 0x31, 0xff])
    } else if (reg === 'rsi') {
      this.#codes.push([0x48, 0x31, 0xf6])
    }
    return this
  }

  // url:         https://www.felixcloutier.com/x86/push
  // OpCode:      50 +rd
  // Instruction: PUSH r64
  // Op/En:       O
  //              1: opcode + rd (r)
  // In 64-bit mode, using a REX prefix in the form of REX.R permits access to 
  // additional registers (R8-R15)..
  push (reg) {
    const idx = gp[reg]
    this.#instr.push(`push %${reg}`)
    if (idx < 8) {
      this.#codes.push([op_push_r64 + idx])
      return this
    }
    this.#codes.push([rex(0, 0, 0, 1), op_push_r64 + (idx % 8)])
    return this
  }

  // url:         https://www.felixcloutier.com/x86/pop
  // OpCode:      58 +rd
  // Instruction: POP r64
  // Op/En:       O
  //              1: opcode + rd (w)
  // In 64-bit mode, using a REX prefix in the form of REX.R permits access to 
  // additional registers (R8-R15)..
  pop (reg) {
    const idx = gp[reg]
    this.#instr.push(`pop %${reg}`)
    if (idx < 8) {
      this.#codes.push([op_pop_r64 + idx])
      return this
    }
    this.#codes.push([rex(0, 0, 0, 1), op_pop_r64 + (idx % 8)])
    return this
  }

  // url:         https://www.felixcloutier.com/x86/add
  add (reg, bytes) {
    this.#add_or_sub(reg, bytes, 'add')
    return this
  }

  // url:         https://www.felixcloutier.com/x86/sub
  sub (reg, bytes) {
    this.#add_or_sub(reg, bytes, 'sub')
    return this
  }

  // url:         https://www.felixcloutier.com/x86/call
  call (address, reg = 'rax') {
    // OpCode:      FF /2
    // Instruction: call r64
    // Op/En:       M
    //              1: ModRM:r/m (r)
    this.#call_or_jmp(address, reg, 'call')
    return this
  }

  // url:         https://www.felixcloutier.com/x86/jmp
  jmp (address, reg = 'rax') {
    // OpCode:      FF /4
    // Instruction: JMP r64
    // Op/En:       M
    //              1: ModRM:r/m (r)
    this.#call_or_jmp(address, reg, 'jmp')
    return this
  }

  // url:         https://www.felixcloutier.com/x86/mov
  movabs (address, reg) {
    // OpCode:      REX.W + B8+ rd io
    // Instruction: MOV r64, imm64
    // Op/En:       OI
    //              1: opcode + rd (w)
    //              2: imm64
    const idx = gp[reg]
    this.#instr.push(`movabs $${address}, %${reg}`)
    this.#codes.push([rex(1, 0, 0, idx < 8 ? 0 : 1), op_mov_imm64 + (idx % 8), 
      ...as_eight_bytes(address)])
    return this
  }

  movreg (src, dest) {
    // OpCode:      REX.W + 89 /r
    // Instruction: MOV r64, r64
    // Op/En:       MR
    //              1: ModRM:r/m (w)
    //              2: ModRM:reg (r)
    const src_idx = gp[src]
    const dest_idx = gp[dest]
    this.#instr.push(`mov %${src}, %${dest}`)
    this.#codes.push([rex(1, src_idx > 7 ? 1 : 0, 0, dest_idx > 7 ? 1 : 0), 
      op_mov_reg_reg, mod_rm(dest_idx % 8, src_idx % 8)])
    return this
  }

  movsrc (src, dest, off) {
    const src_idx = gp[src]
    const dest_idx = gp[dest]
    if (off === 0) {
      // OpCode:      REX.W + 8B /r
      // Instruction: MOV r64, m64
      // Op/En:       RM
      //              1: ModRM:reg (w)
      //              2: ModRM:r/m (r)
      this.#instr.push(`mov (%${src}), %${dest}`)
      this.#codes.push([rex(1, dest_idx > 7 ? 1 : 0, 0, src_idx > 7 ? 1 : 0), 
        op_mov_mem_reg, mod_rm(src_idx % 8, dest_idx % 8, funny_registers.includes(src) ? 1 : 0)])
      return this
    }
    this.#instr.push(`mov ${off}(%${src}), %${dest}`)
    if (src === 'rsp' || src === 'r12') {
      if (off < 128) {
        this.#codes.push([rex(1, dest_idx > 7 ? 1 : 0, 0, src_idx > 7 ? 1 : 0), 
          op_mov_mem_reg, mod_rm(src_idx % 8, dest_idx % 8, 1), 0x24, off])
      } else {
        this.#codes.push([rex(1, dest_idx > 7 ? 1 : 0, 0, src_idx > 7 ? 1 : 0), 
          op_mov_mem_reg, mod_rm(src_idx % 8, dest_idx % 8, 0b10), 0x24, ...as_four_bytes(off)])
      }
    } else {
      if (off < 128) {
        this.#codes.push([rex(1, dest_idx > 7 ? 1 : 0, 0, src_idx > 7 ? 1 : 0), 
          op_mov_mem_reg, mod_rm(src_idx % 8, dest_idx % 8, 1), off])
      } else {
        this.#codes.push([rex(1, dest_idx > 7 ? 1 : 0, 0, src_idx > 7 ? 1 : 0), 
          op_mov_mem_reg, mod_rm(src_idx % 8, dest_idx % 8, 0b10), ...as_four_bytes(off)])
      }
    }
    return this
  }

  movdest (src, dest, off) {
    const src_idx = gp[src]
    const dest_idx = gp[dest]
    if (off === 0) {
      // OpCode:      REX.W + 89 /r
      // Instruction: MOV m64, r64
      // Op/En:       MR
      //              1: ModRM:r/m (r)
      //              2: ModRM:reg (w)
      this.#instr.push(`mov %${src}, (%${dest})`)
      // todo: in some cases i need this extra byte on the end - need to understand better the rules here
      if (dest === 'rbx') {
        this.#codes.push([rex(1, src_idx > 7 ? 1 : 0, 0, dest_idx > 7 ? 1 : 0), 
          op_mov_reg_mem, mod_rm(dest_idx % 8, src_idx % 8, funny_registers.includes(dest) ? 1 : 0)])
      } else if (dest === 'rsi') {
        this.#codes.push([rex(1, src_idx > 7 ? 1 : 0, 0, dest_idx > 7 ? 1 : 0), 
          op_mov_reg_mem, mod_rm(dest_idx % 8, src_idx % 8, funny_registers.includes(dest) ? 1 : 0)])
      } else {
        this.#codes.push([rex(1, src_idx > 7 ? 1 : 0, 0, dest_idx > 7 ? 1 : 0), 
          op_mov_reg_mem, mod_rm(dest_idx % 8, src_idx % 8, funny_registers.includes(dest) ? 1 : 0), 0x24])
      }
      return this
    }
    this.#instr.push(`mov %${src}, ${off}(%${dest})`)
    if (dest === 'rsp' || dest === 'r12') {
      if (off < 128) {
        this.#codes.push([rex(1, src_idx > 7 ? 1 : 0, 0, dest_idx > 7 ? 1 : 0), 
          op_mov_reg_mem, mod_rm(dest_idx % 8, src_idx % 8, 1), 0x24, off])
      } else {
        this.#codes.push([rex(1, src_idx > 7 ? 1 : 0, 0, dest_idx > 7 ? 1 : 0), 
          op_mov_reg_mem, mod_rm(dest_idx % 8, src_idx % 8, 0b10), 0x24, ...as_four_bytes(off)])
      }
    } else {
      if (off < 128) {
        this.#codes.push([rex(1, src_idx > 7 ? 1 : 0, 0, dest_idx > 7 ? 1 : 0), 
          op_mov_reg_mem, mod_rm(dest_idx % 8, src_idx % 8, 1), off])
      } else {
        this.#codes.push([rex(1, src_idx > 7 ? 1 : 0, 0, dest_idx > 7 ? 1 : 0), 
          op_mov_reg_mem, mod_rm(dest_idx % 8, src_idx % 8, 0b10), ...as_four_bytes(off)])
      }
    }
    return this
  }

  ret () {
    this.#instr.push('ret')
    this.#codes.push([0xc3])
    return this
  }

  syscall () {
    this.#instr.push('syscall')
    this.#codes.push([0x0f, 0x05])
    return this
  }

  reset () {
    this.#instr = []
    this.#codes = []
    return this
  }

  bytes () {
    return new Uint8Array(this.#codes.flat())
  }

  get src () {
    const { codes, instr } = this
    return instr.map((v, i) => [`# ${codes[i].map(v => '0x' + v.toString(16))}`, v]).flat().join('\n') + '\n'
  }

  get instr () {
    return this.#instr
  }

  get codes () {
    return this.#codes
  }

}

export { Assembler, Registers, as_eight_bytes, as_four_bytes }
