const api = {
  hesc_escape_html: {
    parameters: ['pointer', 'string', 'u32'],
    pointers: ['char*'],
    result: 'u32'
  },
}

const name = 'hescape'
const constants = {}
const includes = []

const preamble = `
#ifdef __cplusplus
extern "C"
    {
#endif
#include <hescape.h>
#ifdef __cplusplus
    }
#endif
`

const obj = ['hescape_c.o']


export { name, api, constants, includes, obj, preamble }
