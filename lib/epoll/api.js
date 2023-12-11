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

const constants = {
  EPOLLIN: 'i32',
  EPOLLOUT: 'i32',
  EPOLLERR: 'i32',
  EPOLLHUP: 'i32',
  EPOLL_CLOEXEC: 'i32',
  EPOLLEXCLUSIVE: 'i32',
  EPOLLWAKEUP: 'i32',
  EPOLLONESHOT: 'i32',
  EPOLLET: 'i32',
  EPOLL_CTL_ADD: 'i32',
  EPOLL_CTL_DEL: 'i32',
  EPOLL_CTL_MOD: 'i32',
  EVENT_SIZE: 12,
  EAGAIN: 'i32',
}

const includes = ['sys/epoll.h', 'unistd.h']
const name = 'epoll'

export { api, includes, name, constants }
