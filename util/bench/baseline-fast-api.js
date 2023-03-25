import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const { assert } = spin

const { baseline } = (new Library()).open().compile(`
int i = 0;
int baseline () {
  return i++;
}
`).bind({
  baseline: {
    result: 'i32',
    parameters: [],
    internal: true
  }
})

assert(baseline() === 0)
assert(baseline() === 1)
assert(baseline() === 2)

run('baseline', baseline, 600000000, 10)
