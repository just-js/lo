import { system } from 'lib/system.js'
import { bind, fastcall } from 'lib/fast.js'
import { run } from 'lib/bench.js'

const { dlopen, dlsym, ptr, assert } = spin

const handle = dlopen('./bug.so', 1)
assert(handle)

const noop = bind(dlsym(handle, 'noop'), 'void', [])
assert(noop.state.ptr)
//const getpid = bind(dlsym(0, 'getpid'), 'i32', [])
//assert(getpid.state.ptr)
//const strnlen = bind(dlsym(0, 'strnlen'), 'i32', ['pointer', 'u32'])
//assert(strnlen.state.ptr)
//const strnlen2 = bind(dlsym(0, 'strnlen'), 'i32', ['string', 'u32'])
//assert(strnlen2.state.ptr)
//const strnlen3 = bind(dlsym(0, 'strnlen'), 'i32', ['buffer', 'u32'])
//assert(strnlen3.state.ptr)

//assert(getpid() === system.getpid())

const encoder = new TextEncoder()
const strb = ptr(encoder.encode('hello\0'))
assert(strb.ptr)

const strptr = strb.ptr
//assert(strnlen(strptr, 1024) === 5)
//assert(strnlen2('hello', 1024) === 5)
//assert(strnlen3(strb, 1024) === 5)

const noop_ptr = noop.state.ptr
noop()
const hello = 'hello'

run('noop', noop, 400000000, 10)
//run('fastcall.noop', () => fastcall(noop_ptr), 400000000, 10)
//run('getpid', getpid, 2000000, 10)
//run('system.getpid', system.getpid, 2000000, 10)
//run('strnlen', () => strnlen(strptr, 1024), 400000000, 10)
//run('strnlen2', () => strnlen2(hello, 1024), 400000000, 10)
//run('strnlen3', () => strnlen3(strb, 1024), 400000000, 10)
