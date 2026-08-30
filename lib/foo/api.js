const api = {
  noop: {
    parameters: [],
    result: 'void',
    nofast: true
  }
}

const preamble = [
  'void noop () {',
  '}'
].join('\n')

const name = 'foo'

const constants = {}

// put comments in here

export { name, api, constants, preamble }
