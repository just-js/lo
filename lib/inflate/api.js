import { exec } from 'lib/proc.js'

const { assert } = lo

const api = {
  inflate: {
    parameters: ['buffer', 'u32', 'buffer', 'u32'],
    pointers: ['unsigned char*', , 'unsigned char*'],
    result: 'i32',
    name: 'em_inflate'
  }
}

const name = 'inflate'
const includes = ['em_inflate.h']

function build (C = 'gcc', CC = 'g++') {
  const status = new Int32Array(2)
  exec(C, ['-c', '-o', 'em_inflate.o', '-O3', '-fomit-frame-pointer', 'em_inflate.c'], status)
  assert(status[0] === 0)
}

const obj = ['em_inflate.o']

export { name, api, build, includes, obj }
