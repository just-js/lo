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
  kill: {
    parameters: ['u64', 'i32'],
    casts: ['(pthread_t)'],
    result: 'i32',
    name: 'pthread_kill'
  },
  detach: {
    parameters: ['u64'],
    casts: ['(pthread_t)'],
    result: 'i32',
    name: 'pthread_detach'
  },
  join: {
    parameters: ['u64', 'pointer'],
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
  attrInit: {
    parameters: ['pointer'],
    pointers: ['pthread_attr_t*'],
    result: 'i32',
    name: 'pthread_attr_init'
  },
  attrDestroy: {
    parameters: ['pointer'],
    pointers: ['pthread_attr_t*'],
    result: 'i32',
    name: 'pthread_attr_destroy'
  },
  attrSetStackSize: {
    parameters: ['pointer', 'u64'],
    pointers: ['pthread_attr_t*'],
    result: 'i32',
    name: 'pthread_attr_setstacksize'
  },
  attrGetStackSize: {
    parameters: ['pointer', 'pointer'],
    pointers: ['const pthread_attr_t*', 'size_t*'],
    result: 'i32',
    name: 'pthread_attr_getstacksize'
  },
}

const structs = ['pthread_attr_t']

const constants = {
  EBUSY: 'i32'
}

const linux = {
  api: {
    tryJoin: {
      parameters: ['u64', 'pointer'],
      pointers: [, 'void**'],
      casts: ['(pthread_t)'],
      result: 'i32',
      name: 'pthread_tryjoin_np',
    },
    setName: {
      parameters: ['u64', 'string'],
      casts: ['(pthread_t)'],
      result: 'i32',
      name: 'pthread_setname_np',
    },
    setAffinity: {
      parameters: ['u64', 'u32', 'buffer'],
      pointers: [, , 'cpu_set_t*'],
      casts: ['(pthread_t)'],
      result: 'i32',
      name: 'pthread_setaffinity_np',
    },
    getAffinity: {
      parameters: ['u64', 'u32', 'buffer'],
      pointers: [, , 'cpu_set_t*'],
      casts: ['(pthread_t)'],
      result: 'i32',
      name: 'pthread_getaffinity_np',
    },
    getcpuclockid: {
      parameters: ['u64', 'u32array'],
      pointers: [, 'clockid_t*'],
      casts: ['(pthread_t)'],
      result: 'i32',
      name: 'pthread_getcpuclockid',
    },
    self: {
      parameters: [],
      result: 'u64',
      name: 'pthread_self',
    },
  }
}

const name = 'pthread'
const includes = ['pthread.h', 'signal.h']
const preamble = `typedef void* (*start_routine)(void*);\n`
const platform = ['linux']
//const libs = ['pthread'] // i.e. '-lpthread' flag to gnu linker

export { name, api, includes, preamble, platform, constants, linux, structs }
