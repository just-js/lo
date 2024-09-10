import { exec } from 'lib/proc.js'
import { fetch } from 'lib/curl.js'
import { isDir, isFile } from 'lib/fs.js'
import * as bindings from 'lib/hescape/api.js'

const { assert } = lo

function build (CC = 'gcc', CXX = 'g++') {
//  if (isFile('hescape_c.o')) return
/*
  if (!isFile('hescape.h')) {
    fetch('https://raw.githubusercontent.com/k0kubun/hescape/master/hescape.h', 'hescape.h')
  }
  if (!isFile('hescape.c')) {
    fetch('https://raw.githubusercontent.com/k0kubun/hescape/master/hescape.c', 'hescape.c')
  }
*/
  const CARGS = CC.split(' ')
  let obj = (bindings.obj || []).slice(0)
  if (!obj.length) return
  if (obj.some(o => !isFile(o))) {
    assert(exec(CARGS[0], [...CARGS.slice(1), '-I.', '-c', '-o', 'hescape_c.o', '-O3', '-fPIC', '-msse4.2', 'hescape.c'])[0] === 0)
  }
}

export { build }
