const { thread } = spin.load('thread')

const { addr, assert } = spin

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
