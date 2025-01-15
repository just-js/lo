// https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst#6the-base-procedure-call-standard
/*
todo

push, pop
ldp, sdp
syscall
merge add/sub
encoding negative offsets/values
floats
structs

*/

const Registers = (new Array(32)).fill(0).map((v, i) => `x${i}`).reduce((p, c, i) => {
  p[c] = c
  return p
}, {})

const gp64 = (new Array(32)).fill(0).map((v, i) => `x${i}`).reduce((p, c, i) => {
  p[c] = i
  return p
}, {})

function to_instrn (bits) {
  return [
    Number(`0b${bits.slice(24, 32).join('')}`),
    Number(`0b${bits.slice(16, 24).join('')}`),
    Number(`0b${bits.slice(8, 16).join('')}`),
    Number(`0b${bits.slice(0, 8).join('')}`)
  ]
}

const sp = Registers.sp = Registers.x31
const { x30 } = Registers

function encode_mov (reg, val, shift = 0, keep = 0, sf = '64') {
  const bits = [
    sf === '64' ? 1: 0,                         // 32
    1,                                          // 31
    keep ? 1: 0,                                // 30
    1,                                // 29
    0,                                // 28
    0,                                // 27
    1,                                // 26
    0,                                // 25
    1,                                // 24
    shift >= 32 ? 1 : 0,                                // 23
    (shift === 16 || shift === 48) ? 1: 0,                                // 22
    val >> 15 & 0x01,                                // 21
    val >> 14 & 0x01,                                // 20
    val >> 13 & 0x01,                                // 19
    val >> 12 & 0x01,                                // 18
    val >> 11 & 0x01,                                // 17
    val >> 10 & 0x01,                                // 16
    val >> 9 & 0x01,                                // 15
    val >> 8 & 0x01,                                // 14
    val >> 7 & 0x01,                                // 13
    val >> 6 & 0x01,                                // 12
    val >> 5 & 0x01,                                // 11
    val >> 4 & 0x01,                                // 10
    val >> 3 & 0x01,                                // 9
    val >> 2 & 0x01,                                // 8
    val >> 1 & 0x01,                                // 7
    val & 0x01,                                // 6
    reg >> 4 & 0x01,                                // 5
    reg >> 3 & 0x01,                                // 4
    reg >> 2 & 0x01,                                // 3
    reg >> 1 & 0x01,                                // 2
    reg & 0x01,                                // 1
  ]
  return to_instrn(bits)
}

function encode_orr (src, dest, sf = '64') {
  const bits = [
    sf === '64' ? 1: 0,                         // 32
    0,                                          // 31
    1,                                // 30
    0,                                // 29
    1,                                // 28
    0,                                // 27
    1,                                // 26
    0,                                // 25
    0,                                // 24
    0,                                // 23
    0,                                // 22
    src >> 4 & 0x01,                                // 21
    src >> 3 & 0x01,                                // 20
    src >> 2 & 0x01,                                // 19
    src >> 1 & 0x01,                                // 18
    src & 0x01,                                // 17
    0,                                // 16
    0,                                // 15
    0,                                // 14
    0,                                // 13
    0,                                // 12
    0,                                // 11
    1,                                // 10
    1,                                // 9
    1,                                // 8
    1,                                // 7
    1,                                // 6
    dest >> 4 & 0x01,                                // 5
    dest >> 3 & 0x01,                                // 4
    dest >> 2 & 0x01,                                // 3
    dest >> 1 & 0x01,                                // 2
    dest & 0x01,                                // 1
  ]
  return to_instrn(bits)
}

function encode_br (reg) {
  const bits = [
    1, // 32
    1, // 31
    0, // 30
    1, // 29
    0, // 28
    1, // 27
    1, // 26
    0, // 25
    0, // 24
    0, // 23
    0, // 22
    1, // 21
    1, // 20
    1, // 19
    1, // 18
    1, // 17
    0, // 16
    0, // 15
    0, // 14
    0, // 13
    0, // 12
    0, // 11
    reg >> 4 & 0x01,                                // 10
    reg >> 3 & 0x01,                                // 9
    reg >> 2 & 0x01,                                // 8
    reg >> 1 & 0x01,                                // 7
    reg & 0x01,                                // 6
    0, // 5
    0, // 4
    0, // 3
    0, // 2
    0, // 1
  ]
  return to_instrn(bits)
}

function encode_blr (reg) {
  const bits = [
    1, // 32
    1, // 31
    0, // 30
    1, // 29

    0, // 28
    1, // 27
    1, // 26
    0, // 25

    0, // 24
    0, // 23
    1, // 22
    1, // 21

    1, // 20
    1, // 19
    1, // 18
    1, // 17
    0, // 16
    0, // 15
    0, // 14
    0, // 13
    0, // 12
    0, // 11
    reg >> 4 & 0x01,                                // 10
    reg >> 3 & 0x01,                                // 9
    reg >> 2 & 0x01,                                // 8
    reg >> 1 & 0x01,                                // 7
    reg & 0x01,                                // 6
    0, // 5
    0, // 4
    0, // 3
    0, // 2
    0, // 1
  ]
  return to_instrn(bits)
}

function encode_bl (off) {
  const bits = [
    1, // 32
    0, // 31
    0, // 30
    1, // 29
    0, // 28
    1, // 27
    off >> 25 & 0x01,                                // 26
    off >> 24 & 0x01,                                // 25
    off >> 23 & 0x01,                                // 24
    off >> 22 & 0x01,                                // 23
    off >> 21 & 0x01,                                // 22
    off >> 20 & 0x01,                                // 21
    off >> 19 & 0x01,                                // 20
    off >> 18 & 0x01,                                // 19
    off >> 17 & 0x01,                                // 18
    off >> 16 & 0x01,                                // 17
    off >> 15 & 0x01,                                // 16
    off >> 14 & 0x01,                                // 15
    off >> 13 & 0x01,                                // 14
    off >> 12 & 0x01,                                // 13
    off >> 11 & 0x01,                                // 12
    off >> 10 & 0x01,                                // 11
    off >> 9 & 0x01,                                // 10
    off >> 8 & 0x01,                                // 9
    off >> 7 & 0x01,                                // 8
    off >> 6 & 0x01,                                // 7
    off >> 5 & 0x01,                                // 6
    off >> 4 & 0x01,                                // 5
    off >> 3 & 0x01,                                // 4
    off >> 2 & 0x01,                                // 3
    off >> 1 & 0x01,                                // 2
    off & 0x01,                                // 1
  ]
  return to_instrn(bits)
}

function encode_b (off) {
  const bits = [
    0, // 32
    0, // 31
    0, // 30
    1, // 29
    0, // 28
    1, // 27
    off >> 25 & 0x01,                                // 26
    off >> 24 & 0x01,                                // 25
    off >> 23 & 0x01,                                // 24
    off >> 22 & 0x01,                                // 23
    off >> 21 & 0x01,                                // 22
    off >> 20 & 0x01,                                // 21
    off >> 19 & 0x01,                                // 20
    off >> 18 & 0x01,                                // 19
    off >> 17 & 0x01,                                // 18
    off >> 16 & 0x01,                                // 17
    off >> 15 & 0x01,                                // 16
    off >> 14 & 0x01,                                // 15
    off >> 13 & 0x01,                                // 14
    off >> 12 & 0x01,                                // 13
    off >> 11 & 0x01,                                // 12
    off >> 10 & 0x01,                                // 11
    off >> 9 & 0x01,                                // 10
    off >> 8 & 0x01,                                // 9
    off >> 7 & 0x01,                                // 8
    off >> 6 & 0x01,                                // 7
    off >> 5 & 0x01,                                // 6
    off >> 4 & 0x01,                                // 5
    off >> 3 & 0x01,                                // 4
    off >> 2 & 0x01,                                // 3
    off >> 1 & 0x01,                                // 2
    off & 0x01,                                // 1
  ]
  return to_instrn(bits)
}

function encode_ldr (src, dest, off = 0) {
  const bits = [
    1, // 32
    1, // 31
    1, // 30
    1, // 29

    1, // 28
    0, // 27
    0, // 26
    1, // 25

    0, // 24
    1, // 23

    off >> 11 & 0x01,                                // 22
    off >> 10 & 0x01,                                // 21
    off >> 9 & 0x01,                                // 20
    off >> 8 & 0x01,                                // 19
    off >> 7 & 0x01,                                // 18
    off >> 6 & 0x01,                                // 17
    off >> 5 & 0x01,                                // 16
    off >> 4 & 0x01,                                // 15
    off >> 3 & 0x01,                                // 14
    off >> 2 & 0x01,                                // 13
    off >> 1 & 0x01,                                // 12
    off & 0x01,                                // 11


    src >> 4 & 0x01,                                // 10
    src >> 3 & 0x01,                                // 9
    src >> 2 & 0x01,                                // 8
    src >> 1 & 0x01,                                // 7
    src & 0x01,                                // 6
    dest >> 4 & 0x01,                                // 5
    dest >> 3 & 0x01,                                // 4
    dest >> 2 & 0x01,                                // 3
    dest >> 1 & 0x01,                                // 2
    dest & 0x01,                                // 1
  ]
  return to_instrn(bits)
}


function encode_stp (src1, src2, dest, off = 0) {
  const abs_off_8 = off !== 0 ? Math.abs(off) / 8 : 0
  const bits = [
    1, // 32
    0, // 31
    1, // 30
    0, // 29

    1, // 28
    0, // 27
    0, // 26
    1, // 25

    1, // 24
    0, // 23

    off < 0 ? 1 : 0,                                // 22
    off >= 0 ? abs_off_8 >> 5 & 0x01 : ~(abs_off_8 >> 5 & 0x01) & 0x01,                                // 21
    off >= 0 ? abs_off_8 >> 4 & 0x01 : ~(abs_off_8 >> 4 & 0x01) & 0x01,                                // 20
    off >= 0 ? abs_off_8 >> 3 & 0x01 : ~(abs_off_8 >> 3 & 0x01) & 0x01,                                // 19
    off >= 0 ? abs_off_8 >> 2 & 0x01 : ~(abs_off_8 >> 2 & 0x01) & 0x01,                                // 18
    off >= 0 ? abs_off_8 >> 1 & 0x01 : ~(abs_off_8 >> 1 & 0x01) & 0x01,                                // 17
    off >= 0 ? abs_off_8 & 0x01 : ~(abs_off_8 & 0x01) & 0x01,                                // 16

    // off < 0 ? 1 : off >> 6 & 0x01,                                // 22
    // (off < 0 ? Math.abs(off) : off) >> 5 & 0x01,                                // 21
    // (off < 0 ? Math.abs(off) : off) >> 4 & 0x01,                                // 20
    // (off < 0 ? Math.abs(off) : off) >> 3 & 0x01,                                // 19
    // (off < 0 ? Math.abs(off) : off) >> 2 & 0x01,                                // 18
    // (off < 0 ? Math.abs(off) : off) >> 1 & 0x01,                                // 17
    // (off < 0 ? Math.abs(off) : off) & 0x01,                                // 16

    src2 >> 4 & 0x01,                                // 15
    src2 >> 3 & 0x01,                                // 14
    src2 >> 2 & 0x01,                                // 13
    src2 >> 1 & 0x01,                                // 12
    src2 & 0x01,                                // 11

    dest >> 4 & 0x01,                                // 10
    dest >> 3 & 0x01,                                // 9
    dest >> 2 & 0x01,                                // 8
    dest >> 1 & 0x01,                                // 7
    dest & 0x01,                                // 6
    src1 >> 4 & 0x01,                                // 5
    src1 >> 3 & 0x01,                                // 4
    src1 >> 2 & 0x01,                                // 3
    src1 >> 1 & 0x01,                                // 2
    src1 & 0x01,                                // 1
  ]
  console.log(to_instrn(bits).map(v => v.toString(16)))
  return to_instrn(bits)
}

function encode_ldp (dest1, dest2, src, off = 0) {
  const bits = [
    1, // 32
    0, // 31
    1, // 30
    0, // 29

    1, // 28
    0, // 27
    0, // 26
    1, // 25

    0, // 24
    0, // 23

    off < 0 ? 1 : off >> 6 & 0x01,                                // 22
    (off < 0 ? Math.abs(off) : off) >> 5 & 0x01,                                // 21
    (off < 0 ? Math.abs(off) : off) >> 4 & 0x01,                                // 20
    (off < 0 ? Math.abs(off) : off) >> 3 & 0x01,                                // 19
    (off < 0 ? Math.abs(off) : off) >> 2 & 0x01,                                // 18
    (off < 0 ? Math.abs(off) : off) >> 1 & 0x01,                                // 17
    (off < 0 ? Math.abs(off) : off) & 0x01,                                // 16

    dest2 >> 4 & 0x01,                                // 15
    dest2 >> 3 & 0x01,                                // 14
    dest2 >> 2 & 0x01,                                // 13
    dest2 >> 1 & 0x01,                                // 12
    dest2 & 0x01,                                // 11

    src >> 4 & 0x01,                                // 10
    src >> 3 & 0x01,                                // 9
    src >> 2 & 0x01,                                // 8
    src >> 1 & 0x01,                                // 7
    src & 0x01,                                // 6
    dest1 >> 4 & 0x01,                                // 5
    dest1 >> 3 & 0x01,                                // 4
    dest1 >> 2 & 0x01,                                // 3
    dest1 >> 1 & 0x01,                                // 2
    dest1 & 0x01,                                // 1
  ]
  return to_instrn(bits)
}

function encode_str (src, dest, off = 0) {
  const bits = [
    1, // 32
    1, // 31
    1, // 30
    1, // 29

    1, // 28
    0, // 27
    0, // 26
    1, // 25

    0, // 24
    0, // 23

    off >> 11 & 0x01,                                // 22
    off >> 10 & 0x01,                                // 21
    off >> 9 & 0x01,                                // 20
    off >> 8 & 0x01,                                // 19
    off >> 7 & 0x01,                                // 18
    off >> 6 & 0x01,                                // 17
    off >> 5 & 0x01,                                // 16
    off >> 4 & 0x01,                                // 15
    off >> 3 & 0x01,                                // 14
    off >> 2 & 0x01,                                // 13
    off >> 1 & 0x01,                                // 12
    off & 0x01,                                // 11


    dest >> 4 & 0x01,                                // 10
    dest >> 3 & 0x01,                                // 9
    dest >> 2 & 0x01,                                // 8
    dest >> 1 & 0x01,                                // 7
    dest & 0x01,                                // 6
    src >> 4 & 0x01,                                // 5
    src >> 3 & 0x01,                                // 4
    src >> 2 & 0x01,                                // 3
    src >> 1 & 0x01,                                // 2
    src & 0x01,                                // 1
  ]
  return to_instrn(bits)
}

function encode_sub (src, dest, off = 0, sf = '64') {
  const bits = [
    sf === '64' ? 1: 0,                         // 32
    1, // 31
    0, // 30
    1, // 29

    0, // 28
    0, // 27
    0, // 26
    1, // 25

    0, // 24
    0, // 23

    off >> 11 & 0x01,                                // 22
    off >> 10 & 0x01,                                // 21
    off >> 9 & 0x01,                                // 20
    off >> 8 & 0x01,                                // 19
    off >> 7 & 0x01,                                // 18
    off >> 6 & 0x01,                                // 17
    off >> 5 & 0x01,                                // 16
    off >> 4 & 0x01,                                // 15
    off >> 3 & 0x01,                                // 14
    off >> 2 & 0x01,                                // 13
    off >> 1 & 0x01,                                // 12
    off & 0x01,                                // 11


    src >> 4 & 0x01,                                // 10
    src >> 3 & 0x01,                                // 9
    src >> 2 & 0x01,                                // 8
    src >> 1 & 0x01,                                // 7
    src & 0x01,                                // 6
    dest >> 4 & 0x01,                                // 5
    dest >> 3 & 0x01,                                // 4
    dest >> 2 & 0x01,                                // 3
    dest >> 1 & 0x01,                                // 2
    dest & 0x01,                                // 1
  ]
  return to_instrn(bits)
}

function encode_add (src, dest, off = 0, sf = '64') {
  const bits = [
    sf === '64' ? 1: 0,                         // 32
    0, // 31
    0, // 30
    1, // 29

    0, // 28
    0, // 27
    0, // 26
    1, // 25

    0, // 24
    0, // 23

    off >> 11 & 0x01,                                // 22
    off >> 10 & 0x01,                                // 21
    off >> 9 & 0x01,                                // 20
    off >> 8 & 0x01,                                // 19
    off >> 7 & 0x01,                                // 18
    off >> 6 & 0x01,                                // 17
    off >> 5 & 0x01,                                // 16
    off >> 4 & 0x01,                                // 15
    off >> 3 & 0x01,                                // 14
    off >> 2 & 0x01,                                // 13
    off >> 1 & 0x01,                                // 12
    off & 0x01,                                // 11


    src >> 4 & 0x01,                                // 10
    src >> 3 & 0x01,                                // 9
    src >> 2 & 0x01,                                // 8
    src >> 1 & 0x01,                                // 7
    src & 0x01,                                // 6
    dest >> 4 & 0x01,                                // 5
    dest >> 3 & 0x01,                                // 4
    dest >> 2 & 0x01,                                // 3
    dest >> 1 & 0x01,                                // 2
    dest & 0x01,                                // 1
  ]
  return to_instrn(bits)
}

function encode_ret (reg = 30) {
  const bits = [
    1, // 32
    1, // 31
    0, // 30
    1, // 29

    0, // 28
    1, // 27
    1, // 26
    0, // 25

    0, // 24
    1, // 23
    0,                                // 22
    1,                                // 21

    1,                                // 20
    1,                                // 19
    1,                                // 18
    1,                                // 17
    0,                                // 16
    0,                                // 15
    0,                                // 14
    0,                                // 13
    0,                                // 12
    0,                                // 11

    reg >> 4 & 0x01,                                // 10
    reg >> 3 & 0x01,                                // 9
    reg >> 2 & 0x01,                                // 8
    reg >> 1 & 0x01,                                // 7
    reg & 0x01,                                // 6
    0,                                // 5
    0,                                // 4
    0,                                // 3
    0,                                // 2
    0,                                // 1
  ]
  return to_instrn(bits)
}

class Assembler {
  #codes = []
  #instr = []

  reset () {
    this.#instr = []
    this.#codes = []
    return this
  }

  ldr (src, dest, off) {
    const src_idx = gp64[src]
    const dest_idx = gp64[dest]
    this.#instr.push(`ldr ${dest}, [${src}, #${off}]`)
    this.codes.push(encode_ldr(src_idx, dest_idx, off))
    return this
  }

  str (src, dest, off = 0) {
    const src_idx = gp64[src]
    const dest_idx = gp64[dest]
    this.#instr.push(`str ${src}, [${dest}, #${off}]`)
    this.codes.push(encode_str(src_idx, dest_idx, off))
    return this
  }

  sub (src, dest, off = 0) {
    const src_idx = gp64[src]
    const dest_idx = gp64[dest]
    this.#instr.push(`sub ${src}, ${dest}, #${off}`)
    this.codes.push(encode_sub(src_idx, dest_idx, off))
    return this
  }

  add (src, dest, off = 0) {
    const src_idx = gp64[src]
    const dest_idx = gp64[dest]
    this.#instr.push(`add ${src}, ${dest}, #${off}`)
    this.codes.push(encode_add(src_idx, dest_idx, off))
    return this
  }

  nop () {
    this.#instr.push('nop')
    this.codes.push([0xd5, 0x03, 0x20, 0x1f])
    return this
  }

  br (reg) {
    const idx = gp64[reg]
    this.#instr.push(`br ${reg}`)
    this.codes.push(encode_br(idx))
    return this
  }

  bl (off) {
    this.#instr.push(`bl #0x${off.toString(16)}`)
    this.codes.push(encode_bl(off / 4))
    return this
  }

  b (off) {
    this.#instr.push(`b #0x${off.toString(16)}`)
    this.codes.push(encode_b(off / 4))
    return this
  }

  blr (reg) {
    const idx = gp64[reg]
    this.#instr.push(`blr ${reg}`)
    this.codes.push(encode_blr(idx))
    return this
  }

  ret (reg = x30) {
    const idx = gp64[reg]
    if (reg === x30) {
      this.#instr.push('ret')
    } else {
      this.#instr.push(`ret ${reg}`)
    }
    this.codes.push(encode_ret(idx))
    return this
  }

  stp (src1, src2, dest, off = 0) {
    const src1_idx = gp64[src1]
    const src2_idx = gp64[src2]
    const dest_idx = gp64[dest]
    this.#instr.push(`stp ${src1}, ${src2}, [${dest === sp ? 'sp' : dest}, #${off}]`)
    this.codes.push(encode_stp(src1_idx, src2_idx, dest_idx, off))
    return this
  }

  ldp (src, dest1, dest2, off = 0) {
    const dest1_idx = gp64[dest1]
    const dest2_idx = gp64[dest2]
    const src_idx = gp64[src]
    this.#instr.push(`ldp ${dest1}, ${dest2}, [${src === sp ? 'sp' : src}, #${off}]`)
    this.codes.push(encode_ldp(dest1_idx, dest2_idx, src_idx, off))
    return this
  }

  movreg (src, dest) {
    const src_idx = gp64[src]
    const dest_idx = gp64[dest]
    if (src === sp || dest === sp) {
      this.#instr.push(`mov ${dest === sp ? 'sp' : dest}, ${src === sp ? 'sp' : src}`)
      this.codes.push(encode_add(src_idx, dest_idx))
    } else {
      this.#instr.push(`mov ${dest}, ${src}`)
      this.codes.push(encode_orr(src_idx, dest_idx))
    }
    return this
  }

  movabs (reg, val) {
    const val64 = BigInt(val)
    this.movz(reg, Number(val64 & 0xffffn))
    this.movk(reg, Number((val64 >> 16n) & 0xffffn), 16)
    this.movk(reg, Number((val64 >> 32n) & 0xffffn), 32)
    this.movk(reg, Number((val64 >> 48n) & 0xffffn), 48)
  }

  movz (reg, u16) {
    const idx = gp64[reg]
    this.#instr.push(`movz ${reg}, #${u16}`)
    this.codes.push(encode_mov(idx, u16))
    return this
  }

  movk (reg, u16, shift = 0) {
    const idx = gp64[reg]
    this.#instr.push(`movk ${reg}, #${u16}, lsl #${shift}`)
    this.codes.push(encode_mov(idx, u16, shift, 1))
    return this
  }

  bytes () {
    return new Uint8Array(this.#codes.flat())
  }

  get src () {
    const { codes, instr } = this
    return instr.map((v, i) => [`# ${codes[i].reverse().map(v => '0x' + v.toString(16))}`, v]).flat().join('\n') + '\n'
  }

  get instr () {
    return this.#instr
  }

  get codes () {
    return this.#codes
  }
}

export { Assembler, Registers }
