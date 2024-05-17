const api = {
  hesc_escape_html: {
    parameters: ['pointer', 'string', 'u32'],
    pointers: ['char*'],
    result: 'u32'
  },
}

const name = 'hescape'
const constants = {}
const includes = ['hescape.h']

const obj = ['hescape_c.o']


export { name, api, constants, includes, obj }
