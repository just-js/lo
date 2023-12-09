const api = {
  kqueue: {
    parameters: [],
    result: 'i32'
  },
  kevent: {
    parameters: ['i32', 'pointer', 'i32', 'pointer', 'i32', 'pointer'],
    pointers: [, 'const struct kevent *', , 'struct kevent *', , 'const struct timespec *'],
    result: 'i32'
  }
}

const name = 'machkq'

const constants = {}
const includes = [
  'sys/event.h', 'sys/types.h', 'sys/time.h'
]

export { name, api, constants, includes }
