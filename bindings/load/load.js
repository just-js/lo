const api = {
  dlopen: {
    parameters: ['pointer', 'i32'],
    pointers: ['const char*'],
    result: 'pointer'
  },
  dlsym: {
    parameters: ['pointer', 'pointer'],
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
const obj = ['load.a']

export { api, includes, name, libs, obj }

