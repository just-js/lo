const { pthread } = lo.load('pthread')

const { addr, assert, ptr } = lo

const rcbuf = ptr(new Uint32Array(2))
const tbuf = new Uint32Array(2)

/**
 * @param {number} address
 * @param {TypedArray} ctx
 */
function spawn (address, ctx) {
  assert(pthread.create(tbuf, 0, address, ctx) === 0)
  return addr(tbuf)
}

/** @param {number} tid */
function join (tid) {
  const rc = pthread.join(tid, rcbuf.ptr)
//  assert(addr(rcbuf) === 0)
  return [rc, addr(rcbuf)]
}

/** @param {number} tid */
function try_join (tid) {
  const rc = pthread.tryJoin(tid, rcbuf.ptr)
  return [rc, addr(rcbuf)]
}

export { pthread, spawn, join, try_join }
