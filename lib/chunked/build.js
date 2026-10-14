import { exec } from 'lib/proc.js'

async function build (CC = 'gcc', CXX = 'g++') {
  const status = new Int32Array(3)
  const CARGS = CC.split(' ')
  const ARCH_ARGS = ['-fPIC', '-O3', '-Wall', '-Wextra', '-std=c11']
  exec(CARGS[0], [...CARGS.slice(1), '-c', '-I.', ...ARCH_ARGS, '-o', 'decoder.o', 'decoder.c'], status)
}

export { build }
