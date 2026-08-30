const api = {
  noop: {
    parameters: [],
    result: 'void'
  }
}

const preamble = [
  'void noop () {',
  '}'
].join('\n')

const name = 'foo_abi'

const constants = {}

// hand-written foo_abi.cc (WORK.E.1 prototype) links lo_abi_v8.cc's V8
// backend in alongside it — see lib/foo_abi/build.js. api/preamble above
// are vestigial (kept for parity with lib/foo's api.js) since NOGEN=1
// keeps lib/build.js from regenerating foo_abi.cc from them.
const obj = ['lo_abi_v8.o']

export { name, api, constants, preamble, obj }
