const api = {
  linenoise: {
    parameters: ['buffer'],
    pointers: ['const char*'],
    result: 'pointer'
  },
  add: {
    parameters: ['pointer'], pointers: ['const char*'],
    result: 'i32', name: 'linenoiseHistoryAdd'
  },
  save: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32', name: 'linenoiseHistorySave'
  },
  load: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32', name: 'linenoiseHistoryLoad'
  },
}

const name = 'lines'
const includes = ['linenoise.h']
// todo: this is just a hack to get this to work for now - need a nice way to specify this
const externs = ['linenoise.h']
const obj = ['linenoise.o']

export { api, name, includes, obj, externs }
