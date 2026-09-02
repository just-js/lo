const api = {
  noop: {
    parameters: [],
    result: 'void',
  },
  noop_slow: {
    parameters: [],
    result: 'void',
    nofast: true,
    name: 'noop'
  },
  noarg_i32: {
    parameters: [],
    result: 'i32',
  },
  noarg_i32_slow: {
    parameters: [],
    result: 'i32',
    nofast: true,
    name: 'noarg_i32'
  },
}

const preamble = `
#include <stdlib.h>
#include <stdint.h>

void noop () {

}

uint32_t noarg_i32 () {
  return 1;
}

`

const name = 'bar'

const constants = {}

export { name, api, constants, preamble }
