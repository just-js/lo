import { dlopen, CString, ptr } from 'bun:ffi'
import { run } from '../../../lib/bench.js'

const { 
  symbols: { noop }
} = dlopen('./bug.so', {
  noop: {
    args: [],
    returns: 'void'
  }
})

const { 
  symbols: { getpid, strnlen }
} = dlopen('\0', {
  getpid: {
    args: [],
    returns: 'i32'
  },
  strnlen: {
    args: ['pointer', 'u32'],
    returns: 'i32'
  }
})

const encoder = new TextEncoder()
const cstring = encoder.encode('hello\0')
const address = ptr(cstring)

run('noop', noop, 400000000, 10)
//run('getpid', getpid, 2000000, 10)
//run('strnlen', () => strnlen(address, 1024), 40000000, 10)
