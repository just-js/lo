import { asm, compiler, Registers } from 'lib/asm.js'
import { bind_custom } from 'lib/ffi.js'

const { core, ptr } = lo
const { read_file, write_file } = core
const decoder = new TextDecoder()

function create () {
  const { compile } = compiler

  const syscalls = JSON.parse(decoder.decode(read_file('lib/x64.json')))

  const { rbx } = Registers

  const os = {}

  asm.reset()
  for (const syscall of Object.values(syscalls)) {
    const { name, syscall_nr, args, reg } = syscall

    const off_slow = asm.size
    asm
      .push(rbx)
      .movreg(Registers[reg[1]], rbx)
      .movabs(syscall_nr, Registers[reg[0]])
    const arglen = args.length
    let off = 8
    for (let i = 0; i < arglen; i++) {
      asm.movsrc(rbx, Registers[reg[i + 1]], off)
      off += 8
    }
    asm.syscall()
      .movdest(Registers[reg[0]], rbx, 0)
      .pop(rbx)
      .ret()

    const off_fast = asm.size
    asm
      .movabs(syscall_nr, Registers[reg[0]])
    for (let i = 0; i < arglen; i++) {
      asm.movreg(Registers[reg[i + 2]], Registers[reg[i + 1]])
    }
    asm.syscall()
      .ret()

    os[name] = { name, args, off_slow, off_fast }
  }

  const bytes = ptr(asm.bytes())
  write_file('os.bin', bytes)
  const base_address = compile(bytes)
  for (const { name, args, off_slow, off_fast } of Object.values(os)) {
    os[name] = bind_custom('u64', args, base_address + off_slow, base_address + off_fast)
  }
  return os
}

export { create }
