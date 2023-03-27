const api = {
  bestline: {
    parameters: ['buffer'], 
    pointers: ['const char*'],
    result: 'pointer'
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

const name = 'bestline'

export { api, name }
