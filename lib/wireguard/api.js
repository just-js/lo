const api = {
  set: {
    parameters: ['pointer'],
    pointers: ['wg_device*'],
    result: 'i32',
    name: 'wg_set_device'
  },
  get: {
    parameters: ['u32array', 'string'],
    pointers: ['wg_device**', 'const char*'],
    result: 'i32',
    name: 'wg_get_device'
  },
  add: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32',
    name: 'wg_add_device'
  },
  delete: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32',
    name: 'wg_del_device'
  },
  free: {
    parameters: ['pointer'],
    pointers: ['wg_device*'],
    result: 'void',
    name: 'wg_free_device'
  },
  list: {
    parameters: [],
    rpointer: 'const char*',
    result: 'pointer',
    name: 'wg_list_device_names'
  },
  keytobase64: {
    parameters: ['buffer', 'buffer'],
    pointers: ['wg_key_b64_string*', 'const wg_key*'],
    casts: ['*', '*'],
    result: 'void',
    name: 'wg_key_to_base64'
  },
  keyfrombase64: {
    parameters: ['buffer', 'buffer'],
    pointers: ['wg_key*', 'const wg_key_b64_string*'],
    casts: ['*', '*'],
    result: 'i32',
    name: 'wg_key_from_base64'
  },
  genpubKey: {
    parameters: ['buffer', 'buffer'],
    pointers: ['wg_key*', 'const wg_key*'],
    casts: ['*', '*'],
    result: 'void',
    name: 'wg_generate_public_key'
  },
  genprivKey: {
    parameters: ['buffer'],
    pointers: ['wg_key*'],
    casts: ['*'],
    result: 'void',
    name: 'wg_generate_private_key'
  },
  genpresharedKey: {
    parameters: ['buffer'],
    pointers: ['wg_key*'],
    casts: ['*'],
    result: 'void',
    name: 'wg_generate_preshared_key'
  }
}

//const includes = ['wireguard.h']
const includes = []
const name = 'wireguard'
const obj = ['wg.o']
const libs = []

const preamble = `
#ifdef __cplusplus
extern "C"
    {
#endif
#include <wireguard.h>
#ifdef __cplusplus
    }
#endif
`


export { api, includes, name, obj, libs, preamble }
