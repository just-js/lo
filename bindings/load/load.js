const api = {
  dlopen: {
    parameters: ['string', 'i32'],
    pointers: ['const char*'],
    result: 'pointer'
  },
  dlsym: {
    parameters: ['pointer', 'string'],
    pointers: ['void*', 'const char*'],
    result: 'pointer'
  },
  dlclose: {
    parameters: ['pointer'],
    pointers: ['void*'],
    result: 'i32'
  }
}

const includes = ['dlfcn.h']
const name = 'load'
const libs = ['dl']
const obj = []

export { api, includes, name, libs, obj }

