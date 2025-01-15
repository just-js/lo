const api = {
  parse: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'pointer',
    name: 'ada_parse'
  },
  parse_str: {
    parameters: ['string', 'u32'],
    pointers: ['const char*'],
    result: 'pointer',
    name: 'ada_parse'
  },
  can_parse: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'u32',
    name: 'ada_can_parse'
  },
  can_parse_str: {
    parameters: ['string', 'u32'],
    pointers: ['const char*'],
    result: 'u32',
    name: 'ada_can_parse'
  },
/*
  can_parse_str2: {
    parameters: ['string', 'u32'],
    override: [, { param: 0, fastfield: '->length', slowfield: '.length()' }],
    pointers: ['const char*'],
    result: 'u32',
    name: 'ada_can_parse'
  },
*/
  get_components: {
    parameters: ['pointer'],
    result: 'pointer',
    rpointer: 'const void*',
    name: 'ada_get_components'
  },
  free: {
    parameters: ['pointer'],
    result: 'void',
    name: 'ada_free'
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
