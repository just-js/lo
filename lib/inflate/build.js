import { exec } from 'lib/proc.js'
import { fetch } from 'lib/curl.js'

const { assert } = lo

function build (C = 'gcc', CC = 'g++') {
  fetch('https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.h', 'em_inflate.h')
  fetch('https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.c', 'em_inflate.c')
  const status = new Int32Array(2)
  const CARGS = C.split(' ')
  exec(CARGS[0], [...CARGS.slice(1), '-I.', '-c', '-o', 'em_inflate.o', '-O3', '-fomit-frame-pointer', 'em_inflate.c'], status)
  assert(status[0] === 0)
}

export { build }
