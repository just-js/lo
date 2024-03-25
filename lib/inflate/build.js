import { exec } from 'lib/proc.js'
import { fetch } from 'lib/curl.js'
import { isFile } from 'lib/fs.js'

const { assert } = lo

function build (CC = 'gcc', CXX = 'g++') {
  if (isFile('em_inflate.o')) return
  if (!isFile('em_inflate.h')) {
    fetch('https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.h', 'em_inflate.h')
  }
  if (!isFile('em_inflate.c')) {
    fetch('https://raw.githubusercontent.com/emmanuel-marty/em_inflate/master/lib/em_inflate.c', 'em_inflate.c')
  }
  const CARGS = CC.split(' ')
  assert(exec(CARGS[0], [...CARGS.slice(1), '-I.', '-c', '-o', 'em_inflate.o', '-O3', 'em_inflate.c'])[0] === 0)
  //assert(exec(CARGS[0], [...CARGS.slice(1), '-I.', '-c', '-o', 'em_inflate.o', '-O2', '-fomit-frame-pointer', 'em_inflate.c'])[0] === 0)
}

export { build }
