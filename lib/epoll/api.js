const api = {
  create: {
    parameters: ['i32'],
    result: 'i32',
    name: 'epoll_create1'
  },
  modify: {
    parameters: ['i32', 'i32', 'i32', 'buffer'],
    pointers: [, , , 'struct epoll_event *'],
    result: 'i32',
    name: 'epoll_ctl'
  },
  wait: {
    parameters: ['i32', 'buffer', 'i32', 'i32'],
    pointers: [, 'struct epoll_event *'],
    result: 'i32',
    name: 'epoll_wait'
  },
  close: {
    parameters: ['i32'],
    result: 'i32',
    name: 'close'
  }
}

const includes = ['sys/epoll.h', 'unistd.h']
const name = 'epoll'

export { api, includes, name }
