const { pthread } = lo.load('pthread')

const { addr, assert, ptr } = lo

const rcbuf = ptr(new Uint32Array(2))
const tbuf = ptr(new Uint32Array(2))

// hoisted so spawn/join's bodies are pure closure-variable reads + constant call
// targets, with no per-call named-property IC feedback needed at all - lets them be
// force-optimized to TURBOFAN at startup with zero prior invocations, see work.js
const pthread_create = pthread.create
const pthread_join = pthread.join
const pthread_tryJoin = pthread.tryJoin
const tbufPtr = tbuf.ptr
const rcbufPtr = rcbuf.ptr

// thread attributes, initialised once, used when a stack size is given
const attr = ptr(new Uint8Array(pthread.struct_pthread_attr_t_size))
assert(pthread.attrInit(attr.ptr) === 0)

// stack_size 0 keeps the libc default (128 KiB on musl: too small for V8,
// which assumes ~1 MB per thread and only throws RangeError within that)
function spawn (address, ctx, stack_size = 0) {
  if (stack_size) {
    assert(pthread.attrSetStackSize(attr.ptr, stack_size) === 0)
    assert(pthread_create(tbufPtr, attr.ptr, address, ctx) === 0)
  } else {
    assert(pthread_create(tbufPtr, 0, address, ctx) === 0)
  }
  return addr(tbuf)
}

function join (tid) {
  const rc = pthread_join(tid, rcbufPtr)
//  assert(addr(rcbuf) === 0)
  return [rc, addr(rcbuf)]
}

function try_join (tid) {
  const rc = pthread_tryJoin(tid, rcbufPtr)
  return [rc, addr(rcbuf)]
}

export { pthread, spawn, join, try_join }
