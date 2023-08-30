import { run } from '../../../lib/bench.js'

const api = Deno.dlopen('\0', {
  strnlen: {
    parameters: ['pointer', 'u32'],
    result: 'i32'
  },
  getpid: {
    parameters: [],
    result: 'i32'
  }
}).symbols

const foo = Deno.dlopen('./bug.so', {
  noop: {
    parameters: [],
    result: 'void'
  },
  add1: {
    parameters: ['i32'],
    result: 'i32'
  },
  add2: {
    parameters: ['i32', 'i32'],
    result: 'i32'
  }
}).symbols

const encoder = new TextEncoder()
const strb = encoder.encode('hello\0')
const ptr = Deno.UnsafePointer.of(strb)

const { strnlen } = api
const { add1, add2, noop } = foo

assert(add1(1) === 2)
assert(add2(1, 2) === 3)
//run('strnlen', () => strnlen(ptr, 1024), 200000000, 10)
//run('getpid', api.getpid, 2000000, 10)
//run('add1', () => add1(1), 400000000, 10)
run('add2', () => add2(1, 2), 400000000, 10)
//run('noop', noop, 400000000, 10)

// a benchmarking tool that runs on node.js, bun, spin and Deno

