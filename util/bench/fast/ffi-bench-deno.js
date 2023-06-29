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

const foo = Deno.dlopen('./module/foo/foo.so', {
  noop: {
    parameters: [],
    result: 'void'
  }
}).symbols

const encoder = new TextEncoder()
const strb = encoder.encode('hello\0')
const ptr = Deno.UnsafePointer.of(strb)

const { strnlen } = api

//run('strnlen', () => strnlen(ptr, 1024), 200000000, 10)
//run('getpid', api.getpid, 2000000, 10)
run('noop', foo.noop, 400000000, 10)