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
  pwait: {
    parameters: ['i32', 'buffer', 'i32', 'i32', 'buffer'],
    pointers: [, 'struct epoll_event *', , ,'const sigset_t*'],
    result: 'i32',
    name: 'epoll_pwait'
  },
  pwait2: {
    parameters: ['i32', 'pointer', 'i32', 'pointer', 'pointer'],
    pointers: [, 'struct epoll_event *', ,'const struct timespec *', 'const sigset_t*'],
    result: 'i32',
    name: 'epoll_pwait2'
  },
  close: {
    parameters: ['i32'],
    result: 'i32',
  },
  prctl: {
    parameters: ['i32', 'u32'],
    result: 'i32',
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
  PR_SET_TIMERSLACK: 'i32',
}

const includes = ['sys/epoll.h', 'unistd.h', 'sys/prctl.h']
const name = 'epoll'

export { api, includes, name, constants }
