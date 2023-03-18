const api = {
  epoll_create1: {
    parameters: ['i32'],
    result: 'i32',
    name: 'create'
  },
  epoll_ctl: {
    parameters: ['i32', 'i32', 'i32', 'pointer'],
    pointers: [, , , 'struct epoll_event *'],
    result: 'i32',
    name: 'modify'
  },
  epoll_wait: {
    parameters: ['i32', 'pointer', 'i32', 'i32'],
    pointers: [, 'struct epoll_event *'],
    result: 'i32',
    name: 'wait'
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
