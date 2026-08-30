const api = {
  noop: {
    parameters: [],
    result: 'void',
    nofast: false
  }
}

const preamble = `
extern "C" {

__attribute__((noinline)) __attribute__((not_tail_called)) void noop () {
  asm volatile ("");
}
}
`
const name = 'foo'

const constants = {}

// put comments in here

export { name, api, constants, preamble }
