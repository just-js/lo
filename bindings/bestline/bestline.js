const api = {
  bestline: {
    parameters: ['pointer'], pointers: ['const char*'],
    result: 'pointer'
  },
  bestlineClearScreen: {
    parameters: ['i32'],
    result: 'void', name: 'cls'
  },
  bestlineHistoryAdd: {
    parameters: ['pointer'], pointers: ['const char*'],
    result: 'i32', name: 'add'
  },
  bestlineHistorySave: {
    parameters: ['pointer'], pointers: ['const char*'],
    result: 'i32', name: 'save'
  },
  bestlineHistoryLoad: {
    parameters: ['pointer'], pointers: ['const char*'],
    result: 'i32', name: 'load'
  }  
}

const name = 'bestline'

export { api, name }
