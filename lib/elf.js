const { encode } = lo.load('encode')

const { read_file } = lo.core
const { hex_encode } = encode

const decoder = new TextDecoder()

function getFileHeader (u8, dv) {
  const out = new Uint8Array(32)
  let magic = decoder.decode(out, hex_encode(u8, 16, out, out.length))
  magic = magic.match(/.{2}/g).join(' ')
  const mag0 = u8[0]
  if (mag0 !== 127) throw new Error('Bad First Byte')
  const mag3 = decoder.decode(u8.subarray(1, 4))
  if (mag3 !== 'ELF') throw new Error('Not Elf')
  const cls = u8[4] === 2 ? 'ELF64' : 'ELF32'
  const endianness = u8[5]
  const version = u8[6]
  const osabi = u8[7]
  const abiversion = u8[8]
  const type = dv.getUint16(16, true)
  const machine = dv.getUint16(18, true)
  const elfVersion = dv.getUint32(20, true)
  if (elfVersion !== 1) throw new Error(`Unknown Elf Version ${elfVersion}`)
  let entrypoint
  let phoff
  let shoff
  let offset = 0
  if (cls === 'ELF64') {
    entrypoint = dv.getBigUint64(24, true)
    phoff = dv.getBigUint64(32, true)
    if (phoff !== 64n) throw new Error('Program Header Offset is not 64')
    shoff = dv.getBigUint64(40, true)
    offset = 48
  } else {
    entrypoint = dv.getUint32(24, true)
    phoff = dv.getUint32(28, true)
    if (phoff !== 32) throw new Error('Program Header Offset is not 32')
    shoff = dv.getUint32(32, true)
    offset = 36
  }
  const flags = dv.getUint32(offset, true)
  offset += 4
  const headerSize = dv.getUint16(offset, true)
  offset += 2
  const phteSize = dv.getUint16(offset, true)
  offset += 2
  const phEntries = dv.getUint16(offset, true)
  offset += 2
  const shteSize = dv.getUint16(offset, true)
  offset += 2
  const shEntries = dv.getUint16(offset, true)
  offset += 2
  const shteIndex = dv.getUint16(offset, true)
  offset += 2
  if (cls === 'ELF64') {
    if (offset !== 64) throw new Error(`Bad Offset ${offset}`)
  } else {
    if (offset !== 52) throw new Error(`Bad Offset ${offset}`)
  }
  return {
    mag0,
    mag3,
    cls,
    endianness,
    version,
    osabi,
    abiversion,
    magic,
    type,
    machine,
    elfVersion,
    entrypoint,
    phoff,
    shoff,
    flags,
    headerSize,
    phteSize,
    phEntries,
    shteSize,
    shEntries,
    shteIndex,
    offset
  }
}

function getTypeDesc (type) {
  if (type === 0x00) return 'ET_NONE'
  if (type === 0x01) return 'ET_REL'
  if (type === 0x02) return 'ET_EXEC'
  if (type === 0x03) return 'ET_DYN'
  if (type === 0x04) return 'ET_CORE'
  if (type === 0xFE00) return 'ET_LOOS'
  if (type === 0xFEFF) return 'ET_HIOS'
  if (type === 0xFF00) return 'ET_LOPROC'
  if (type === 0xFFFF) return 'ET_HIPROC'
  return 'Unknown'
}

function getMachineDesc (machine) {
  if (machine === 0x00) return 'No specific instruction set'
  if (machine === 0x01) return 'AT&T WE 32100'
  if (machine === 0x02) return 'SPARC'
  if (machine === 0x03) return 'x86'
  if (machine === 0x04) return 'Motorola 68000 (M68k)'
  if (machine === 0x05) return 'Motorola 88000 (M88k)'
  if (machine === 0x06) return 'Intel MCU'
  if (machine === 0x07) return 'Intel 80860'
  if (machine === 0x08) return 'MIPS'
  if (machine === 0x09) return 'IBM_System/370'
  if (machine === 0x0A) return 'MIPS RS3000 Little-endian'
  if (machine === 0x0E) return 'Hewlett-Packard PA-RISC'
  if (machine === 0x13) return 'Intel 80960'
  if (machine === 0x14) return 'PowerPC'
  if (machine === 0x15) return 'PowerPC (64-bit)'
  if (machine === 0x16) return 'S390, including S390x'
  if (machine === 0x28) return 'ARM (up to ARMv7/Aarch32)'
  if (machine === 0x2A) return 'SuperH'
  if (machine === 0x32) return 'IA-64'
  if (machine === 0x3E) return 'amd64'
  if (machine === 0x8C) return 'TMS320C6000 Family'
  if (machine === 0xB7) return 'ARM 64-bits (ARMv8/Aarch64)'
  if (machine === 0xF3) return 'RISC-V'
  if (machine === 0x101) return 'WDC 65C816'
  return 'Unknown'
}

function getAbiDesc (abi) {
  if (abi === 0x00) return 'System V'
  if (abi === 0x01) return 'HP-UX'
  if (abi === 0x02) return 'NetBSD'
  if (abi === 0x03) return 'Linux'
  if (abi === 0x04) return 'GNU Hurd'
  if (abi === 0x06) return 'Solaris'
  if (abi === 0x07) return 'AIX'
  if (abi === 0x08) return 'IRIX'
  if (abi === 0x09) return 'FreeBSD'
  if (abi === 0x0A) return 'Tru64'
  if (abi === 0x0B) return 'Novell Modesto'
  if (abi === 0x0C) return 'OpenBSD'
  if (abi === 0x0D) return 'OpenVMS'
  if (abi === 0x0E) return 'NonStop Kernel'
  if (abi === 0x0F) return 'AROS'
  if (abi === 0x10) return 'Fenix OS'
  if (abi === 0x11) return 'CloudABI'
  if (abi === 0x12) return 'Stratus Technologies OpenVOS'
  return 'Unknown'
}

function getEndiannessDesc (endianness) {
  if (endianness === 1) return 'little endian'
  return 'big endian'
}

function dumpHeader (header) {
  console.log(`ELF Header:
  Magic:                             ${header.magic} 
  Class:                             ${header.cls}
  Data:                              ${getEndiannessDesc(header.endianness)}
  Version:                           ${header.version}
  OS/ABI:                            ${getAbiDesc(header.osabi)}
  ABI Version:                       ${header.abiversion}
  Type:                              ${getTypeDesc(header.type)}
  Machine:                           ${getMachineDesc(header.machine)}
  Version:                           ${header.elfVersion}
  Entry point address:               ${header.entrypoint}
  Start of program headers:          ${header.phoff}
  Start of section headers:          ${header.shoff}
  Flags:                             ${header.flags}
  Size of this header:               ${header.headerSize}
  Size of program headers:           ${header.phteSize}
  Number of program headers:         ${header.phEntries}
  Size of section headers:           ${header.shteSize}
  Number of section headers:         ${header.shEntries}
  Section header string table index: ${header.shteIndex}`)
}

function getHeader (fileName = '/proc/self/exe') {
  const u8 = read_file(fileName)
  const dv = new DataView(u8.buffer)
  const header = getFileHeader(u8, dv)
  header.bytes = u8
  return header
}

export { getHeader, dumpHeader, getEndiannessDesc, getAbiDesc, getTypeDesc, getMachineDesc }
