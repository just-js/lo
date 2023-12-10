const { thread } = lo.load('pthread')

const { addr, assert } = lo

const rcbuf = new Uint32Array(2)
const tbuf = new Uint32Array(2)

function spawn (address, ctx) {
  assert(thread.create(tbuf, 0, address, ctx) === 0)
  return addr(tbuf)
}

function join (tid) {
  thread.join(tid, rcbuf)
  assert(addr(rcbuf) === 0)
}

export { thread, spawn, join }
