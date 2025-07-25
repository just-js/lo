import { exec } from 'lib/proc.js'
import { fetch } from 'lib/curl.js'
import { isFile } from 'lib/fs.js'

const { assert } = lo

function build (CC = 'gcc', CXX = 'g++') {
//todo: a way to force re-compile and clean
//  if (isFile('bestline.o')) return
  console.log('willy')
  if (!isFile('linenoise.h')) {
    fetch('https://raw.githubusercontent.com/antirez/linenoise/master/linenoise.h', 'linenoise.h')
  }
  if (!isFile('linenoise.c')) {
    fetch('https://raw.githubusercontent.com/antirez/linenoise/master/linenoise.c', 'linenoise.c')
  }
  const CARGS = CC.split(' ')
  assert(exec(CARGS[0], [...CARGS.slice(1), '-I.', '-fPIC', '-c', '-o', 'linenoise.o', '-O3', 'linenoise.c'])[0] === 0)
}

export { build }
