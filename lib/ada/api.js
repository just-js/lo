const api = {
  ada_parse: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'pointer'
  },
/*
  ada_parse_str: {
    parameters: ['string', 'u32'],
    pointers: ['const char*'],
    override: [, { param: 0, fastfield: '->length', slowfield: '.length()' }],
    result: 'pointer',
    name: 'ada_parse'
  },
*/
  ada_parse_str: {
    parameters: ['string', 'u32'],
    pointers: ['const char*'],
    result: 'pointer',
    name: 'ada_parse'
  },
  ada_free: {
    parameters: ['pointer'],
    result: 'void'
  }
}

const preamble = `
#ifdef __cplusplus
extern "C"
    {
#endif
#include <ada_c.h>
#ifdef __cplusplus
    }
#endif
`

const name = 'ada'
const obj = ['ada_cpp.o']
const includes = []

export { name, api, obj, includes, preamble }
