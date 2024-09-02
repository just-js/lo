const api = {
  bestline: {
    parameters: ['buffer'],
    pointers: ['const char*'],
    result: 'pointer'
  },
  bestline_raw: {
    parameters: ['buffer', 'i32', 'i32'],
    pointers: ['const char*'],
    result: 'pointer',
    name: 'bestlineRaw'
  },
  cls: {
    parameters: ['i32'],
    result: 'void', name: 'bestlineClearScreen'
  },
  add: {
    parameters: ['pointer'], pointers: ['const char*'],
    result: 'i32', name: 'bestlineHistoryAdd'
  },
  save: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32', name: 'bestlineHistorySave'
  },
  load: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32', name: 'bestlineHistoryLoad'
  }
}

const name = 'bestlines'
const includes = ['bestline.h']
// todo: this is just a hack to get this to work for now - need a nice way to specify this
const externs = ['bestline.h']
const obj = ['bestline.o']

export { api, name, includes, obj, externs }
