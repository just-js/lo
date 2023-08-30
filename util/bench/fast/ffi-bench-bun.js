import { dlopen, CString, ptr } from 'bun:ffi'
import { run } from '../../../lib/bench.js'

const { 
  symbols: { noop, add1, add2 }
} = dlopen('./bug.so', {
  noop: {
    args: [],
    returns: 'void'
  },
  add1: {
    args: ['i32'],
    returns: 'i32'
  },
  add2: {
    args: ['i32', 'i32'],
    returns: 'i32'
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

assert(add1(1) === 2)
assert(add2(1, 2) === 3)

run('noop', noop, 400000000, 10)
//run('add1', () => add1(1), 400000000, 10)
//run('add2', () => add2(1, 2), 400000000, 10)
//run('getpid', getpid, 2000000, 10)
//run('strnlen', () => strnlen(address, 1024), 40000000, 10)
