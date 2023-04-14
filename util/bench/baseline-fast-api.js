import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const { assert } = spin

const {
  baseline, noop
} = (new Library()).open().compile(`
int i = 0;
int baseline () {
  return i++;
}
void noop () {

}
`).bind({
  baseline: {
    result: 'i32',
    parameters: [],
    internal: true
  },
  noop: {
    result: 'void',
    parameters: [],
    internal: true
  }
})

assert(baseline() === 0)
assert(baseline() === 1)
assert(baseline() === 2)

run('baseline', baseline, 600000000, 10)
//run('noop', noop, 600000000, 10)
