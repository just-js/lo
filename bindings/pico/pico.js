const api = {
  parseRequest: {
    parameters: ['buffer', 'u32', 'buffer'],
    pointers: ['char*', ,'httpRequest*'],
    result: 'i32',
    name: 'parse_request'
  },
  parseRequest2: {
    parameters: ['pointer', 'u32', 'pointer'],
    pointers: ['char*', ,'httpRequest*'],
    result: 'i32',
    name: 'parse_request'
  },
  parseResponse: {
    parameters: ['buffer', 'u32', 'buffer'],
    pointers: ['char*', ,'httpResponse*'],
    result: 'i32',
    name: 'parse_response'
  },
  parseResponse2: {
    parameters: ['pointer', 'u32', 'pointer'],
    pointers: ['char*', ,'httpResponse*'],
    result: 'i32',
    name: 'parse_response'
  }
}

const name = 'pico'
const includes = ['pico.h']

export { name, api, includes }
