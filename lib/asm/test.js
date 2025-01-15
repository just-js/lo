import { Assembler, Registers } from 'lib/asm.js'
import { exec } from 'lib/proc.js'
import { write_flags, write_mode } from 'lib/fs.js'

const { assert, colors, core } = lo
const { dup2, open, close, STDOUT, read_file, write_file } = core
const { AY, AD, AG, AC, AR } = colors

const gp64 = Object.keys(Registers)
const MAX_INT32 = Math.pow(2, 31) - 1

async function assemble_and_compare (asm) {
  const { codes, instr } = asm
  const src = instr.map((v, i) => [`# ${codes[i].map(v => '0x' + v.toString(16))}`, v]).flat().join('\n') + '\n'
  const encoder = new TextEncoder()
  write_file('asm.txt', encoder.encode(src))
  assert(exec('as', ['asm.txt'])[0] === 0)
  const fd = open('assembler.asm', write_flags, write_mode)
  assert(fd > 2)
  assert(dup2(fd, STDOUT) === STDOUT)
  assert(exec('objdump', ['-d', '--insn-width=16', 'a.out'])[0] === 0)
  close(STDOUT)
  const decoder = new TextDecoder()
  const asm_src = decoder.decode(read_file('assembler.asm'))
  const lines = asm_src.split('\n')
  const asm_codes = []
  for (const line of lines) {
    const match = line.match(/\s[\d\w]+:\s+((:?[\d\w][\d\w]\s)+)\s+\w+\s.+/)
    if (match && match.length > 1) {
      const bytes = match[1].trim().split(' ').map(b => parseInt(b, 16))
      asm_codes.push(bytes)
    }
  }
  const to_hex = c => c.toString(16).padStart(8, ' ')
  const to_binary = c => c.toString(2).padStart(8, '0')
  const to_decimal = c => c.toString().padStart(8, ' ')
  assert(codes.length === asm_codes.length)
  let ok = true
  for (let i = 0; i < codes.length; i++) {
    const err = ((codes[i].some((c, j) => c !== asm_codes[i][j])))
    const SC = err ? AR : AG
    if (err) {
      ok = false
      console.error(`${AC}${instr[i]}${AD}`)
      console.error(`${SC}gen${AD} ${codes[i].map(to_decimal).join(' ')}  ${AY}asm${AD} ${asm_codes[i].map(to_decimal).join(' ')}`)
      console.error(`${SC}gen${AD} ${codes[i].map(to_hex).join(' ')}  ${AY}asm${AD} ${asm_codes[i].map(to_hex).join(' ')}`)
      console.error(`${SC}gen${AD} ${codes[i].map(to_binary).join(' ')}  ${AY}asm${AD} ${asm_codes[i].map(to_binary).join(' ')}`)
      console.error(`        WRXB`)
      console.error('')
    }
  }
  return ok
}


async function test () {

  const asm = new Assembler()

  gp64.forEach(reg => asm.push(reg))
  gp64.forEach(reg => asm.pop(reg))
  gp64.forEach(reg => {
    const vals = [1, 2, 16, 32, 64, 127, 128, 255, 256, 65536, MAX_INT32]
    vals.forEach(v => asm.add(reg, v))
    vals.forEach(v => asm.sub(reg, v))
  })

  gp64.forEach(reg => {
    asm.call(0x10000000, reg)
    asm.call(0x1, reg)
    asm.call(Number.MAX_SAFE_INTEGER, reg)
    asm.jmp(0x10000000, reg)
    asm.jmp(0x1, reg)
    asm.jmp(Number.MAX_SAFE_INTEGER, reg)
  })

  gp64.forEach(src => {
    gp64.forEach(dest => {
      asm.movreg(src, dest)
      asm.movreg(dest, src)
    })
  })

  gp64.forEach(reg => {
    asm.movabs(0x10000000, reg)
    asm.movabs(0x1, reg)
    asm.movabs(Number.MAX_SAFE_INTEGER, reg)
  })

  gp64.forEach(dest => {
    gp64.forEach(src => {
      asm.movsrc(src, dest, 0)
      asm.movsrc(src, dest, 1)
      asm.movsrc(src, dest, 128)
      asm.movsrc(src, dest, 16384)
      asm.movsrc(src, dest, 65536)
      asm.movsrc(src, dest, MAX_INT32)
    })
  })

  gp64.forEach(dest => {
    gp64.forEach(src => {
      asm.movdest(src, dest, 0)
      asm.movdest(src, dest, 1)
      asm.movdest(src, dest, 128)
      asm.movdest(src, dest, 16384)
      asm.movdest(src, dest, 65536)
      asm.movdest(src, dest, MAX_INT32)
    })
  })

  asm.ret()

  const ok = await assemble_and_compare(asm)
  if (!ok) lo.exit(1)

}

export { test }
