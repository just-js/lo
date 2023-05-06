const api = {
  create: {
    parameters: ['u32array', 'pointer', 'pointer', 'buffer'],
    pointers: ['pthread_t*', 'const pthread_attr_t*', 'start_routine'],
    result: 'i32',
    name: 'pthread_create'
  },
  cancel: {
    parameters: ['u64'],
    casts: ['(pthread_t)'],
    result: 'i32',
    name: 'pthread_cancel'
  },
  self: {
    parameters: [],
    result: 'u64',
    name: 'pthread_self'
  },
  detach: {
    parameters: ['u64'],
    casts: ['(pthread_t)'],
    result: 'i32',
    name: 'pthread_detach'
  },
  join: {
    parameters: ['u64', 'u32array'],
    pointers: [, 'void**'],
    casts: ['(pthread_t)'],
    result: 'i32',
    name: 'pthread_join'
  },
  exit: {
    parameters: ['u32array'],
    pointers: [],
    result: 'void',
    name: 'pthread_exit'
  },
  tryJoin: {
    parameters: ['u64', 'u32array'],
    pointers: [, 'void**'],
    casts: ['(pthread_t)'],
    result: 'i32',
    name: 'pthread_tryjoin_np'
  },
  setName: {
    parameters: ['u64', 'string'],
    casts: ['(pthread_t)'],
    result: 'i32',
    name: 'pthread_setname_np'
  },
  setAffinity: {
    parameters: ['u64', 'u32', 'buffer'],
    pointers: [, , 'cpu_set_t*'],
    casts: ['(pthread_t)'],
    result: 'i32',
    name: 'pthread_setaffinity_np'
  },
  getAffinity: {
    parameters: ['u64', 'u32', 'buffer'],
    pointers: [, , 'cpu_set_t*'],
    casts: ['(pthread_t)'],
    result: 'i32',
    name: 'pthread_getaffinity_np'
  }
}

const name = 'thread'
const includes = ['pthread.h']
const preamble = `typedef void* (*start_routine)(void*);\n`

export { name, api, includes, preamble }
