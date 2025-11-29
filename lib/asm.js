import { Compiler } from 'lib/asm/compiler.js'

const { arch } = lo.core
const { Registers, Assembler } = await import(`lib/asm/${arch}.js`)

const compiler = new Compiler()
const asm = new Assembler()

export { Registers, Compiler, Assembler, compiler, asm }

// https://www.chromium.org/chromium-os/developer-library/reference/linux-constants/syscalls/
// https://github.com/GregoryComer/x86-csv/blob/master/x86.csv
