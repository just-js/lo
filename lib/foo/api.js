const api = {
  noop: {
    parameters: [],
    result: 'void'
  },
  no_args_i32: {
    parameters: [],
    result: 'i32'
  },
  one_i32arg_i32: {
    parameters: ['i32'],
    result: 'i32'
  }
}

const preamble = `
extern "C" {

__attribute__((noinline)) __attribute__((not_tail_called)) void noop () {
  asm volatile ("");
}

int no_args_i32 () {
  return 1;
}

int one_i32arg_i32 (int a) {
  return a + 1;
}
}
`
const name = 'foo'

const constants = {}

export { name, api, constants, preamble }
