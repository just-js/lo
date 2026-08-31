// Standard test.js entrypoint (`lo lib/epoll/test.js`) -- real epoll
// syscalls plus the `structs` gap (E.9) validated against a real
// binding: struct_struct_stat_size-style double-prefixed naming is a
// pre-existing quirk shared with the V8-codegen path's own initStruct,
// not new here -- see doc/WORK.md's E.9 correction.

const { assert } = lo

async function test () {
  const { epoll } = lo.load('epoll')

  assert(epoll.struct_epoll_event_size === 12, 'struct_epoll_event_size')
  assert(epoll.EPOLLIN === 1, 'EPOLLIN')
  assert(epoll.EPOLL_CTL_ADD === 1, 'EPOLL_CTL_ADD')

  const fd = epoll.create(0)
  assert(fd > 0, 'epoll_create1')
  assert(epoll.close(fd) === 0, 'close')

  console.log('epoll: ok')
}

export { test }
