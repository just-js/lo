import { exec } from 'lib/proc.js'
import { fetch } from 'lib/curl.js'
import { isFile } from 'lib/fs.js'

const { assert } = lo

function build (CC = 'gcc', CXX = 'g++') {
//todo: a way to force re-compile and clean
//  if (isFile('bestline.o')) return
  if (!isFile('bestline.h')) {
    fetch('https://raw.githubusercontent.com/jart/bestline/master/bestline.h', 'bestline.h')
  }
  if (!isFile('bestline.c')) {
    fetch('https://raw.githubusercontent.com/jart/bestline/master/bestline.c', 'bestline.c')
  }
  const CARGS = CC.split(' ')
  assert(exec(CARGS[0], [...CARGS.slice(1), '-I.', '-fPIC', '-c', '-o', 'bestline.o', '-O3', 'bestline.c'])[0] === 0)
}

export { build }
