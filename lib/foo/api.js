const api = {
  noop: {
    parameters: [],
    result: 'void',
    nofast: true
  }
}

const preamble = `
extern "C" {

void noop () {

}
}
`
const name = 'foo'

const constants = {}

// put comments in here

export { name, api, constants, preamble }
