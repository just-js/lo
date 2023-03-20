import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const { assert, args } = spin

const { baseline } = (new Library()).open().compile(`
typedef int int32_t;

int i = 0;
int func_trampoline () {
  return i++;
}
`).bind({
  func_trampoline: {
    result: 'i32',
    parameters: [],
    internal: true,
    name: 'baseline'
  }
})

const repeat = Number(args[2] || 10)
assert(baseline() === 0)
assert(baseline() === 1)
assert(baseline() === 2)

while (1) {
  run('baseline', baseline, 600000000, repeat)
}
