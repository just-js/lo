const api = {
  inflate: {
    parameters: ['buffer', 'u32', 'buffer', 'u32'],
    pointers: ['unsigned char*', , 'unsigned char*'],
    result: 'i32',
    name: 'em_inflate'
  },
  inflate2: {
    parameters: ['pointer', 'u32', 'pointer', 'u32'],
    pointers: ['unsigned char*', , 'unsigned char*'],
    result: 'i32',
    name: 'em_inflate'
  }
}

const name = 'inflate'
const includes = ['em_inflate.h']

const obj = ['em_inflate.o']

export { name, api, includes, obj }
