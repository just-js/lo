import { fetch } from 'lib/curl.js'
import { exec } from 'lib/proc.js'
import { isDir, isFile } from 'lib/fs.js'

async function build (CC = 'gcc', CXX = 'g++') {
  if (!isFile('picohttpparser.h')) {
    fetch('https://raw.githubusercontent.com/h2o/picohttpparser/master/picohttpparser.h', 'picohttpparser.h')
  }
  if (!isFile('picohttpparser.c')) {
    fetch('https://raw.githubusercontent.com/h2o/picohttpparser/master/picohttpparser.c', 'picohttpparser.c')
  }
  const status = new Int32Array(2)
  const CARGS = CC.split(' ')
  const ARCH_ARGS = ['-fPIC', '-O3', '-Wall', '-Wextra', '-std=c11']
  if (lo.core.arch === 'x64') ARCH_ARGS.push('-msse4')
  exec(CARGS[0], [...CARGS.slice(1), '-c', '-I.', ...ARCH_ARGS, '-o', 'picohttpparser.o', 'picohttpparser.c'], status)
}

export { build }
