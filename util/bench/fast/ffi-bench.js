import { system } from 'lib/system.js'
import { bind, fastcall } from './lib/fast.js'
import { run } from 'lib/bench.js'
//import { Library } from 'lib/ffi.js'


const { dlopen, dlsym, ptr, assert } = spin

// gcc -O3 -s -o bug.so -shared -mtune=native -march=native -mavx -msse4 bug.c
const handle = dlopen('./bug.so', 1)
assert(handle)

const noop = bind(dlsym(handle, 'noop'), 'void', [])
assert(noop.state.ptr)
const noop_slow = bind(dlsym(handle, 'noop'), 'void', [], true)
assert(noop.state.ptr)
const add1 = bind(dlsym(handle, 'add1'), 'i32', ['i32'])
assert(add1.state.ptr)
const add2 = bind(dlsym(handle, 'add2'), 'i32', ['i32', 'i32'])
assert(add2.state.ptr)
const getpid = bind(dlsym(0, 'getpid'), 'i32', [])
assert(getpid.state.ptr)
const strnlen = bind(dlsym(0, 'strnlen'), 'i32', ['pointer', 'u32'])
assert(strnlen.state.ptr)
const strnlen2 = bind(dlsym(0, 'strnlen'), 'i32', ['string', 'u32'])
assert(strnlen2.state.ptr)
const strnlen3 = bind(dlsym(0, 'strnlen'), 'i32', ['buffer', 'u32'])
assert(strnlen3.state.ptr)
/*
const ffi = (new Library()).open('./bug.so').bind({
  noop: {
    result: 'void',
    parameters: []
  },
  noop_slow: {
    result: 'void',
    parameters: [],
    name: 'noop',
    nofast: true
  }
})
*/
assert(noop() === undefined)
//assert(ffi.noop() === undefined)
assert(getpid() === system.getpid())
const encoder = new TextEncoder()
const strb = ptr(encoder.encode('hello\0'))
assert(strb.ptr)
const strptr = strb.ptr
assert(strnlen(strptr, 1024) === 5)
assert(strnlen2('hello', 1024) === 5)
assert(strnlen3(strb, 1024) === 5)
const noop_ptr = noop.state.ptr
const hello = 'hello'
assert(add1(1) === 2)
assert(add2(1, 2) === 3)
// noop - 18ns slow, 4ns fast
run('noop', noop, 400000000, 10)
//run('noop_slow', noop_slow, 400000000, 10)
//run('libffi-noop', ffi.noop, 400000000, 10)
//run('libffi-noop-slow', ffi.noop_slow, 400000000, 10)
//run('add1', () => add1(1), 400000000, 10)
//run('add2', () => add2(1, 2), 400000000, 10)
//run('fastcall.noop', () => fastcall(noop_ptr), 400000000, 10)
//run('getpid', getpid, 2000000, 10)
//run('system.getpid', system.getpid, 2000000, 10)
//run('strnlen', () => strnlen(strptr, 1024), 400000000, 10)
//run('strnlen2', () => strnlen2(hello, 1024), 400000000, 10)
//run('strnlen3', () => strnlen3(strb, 1024), 400000000, 10)
