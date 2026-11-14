// test binding for V8 fast calls in a startup snapshot (PLAN.md task 66 (a),
// V8-SNAPSHOT.md §11): the same C function exported as a fast call (add) and
// slow-only (add_slow) as the control
const api = {
  add: {
    parameters: ['u32', 'u32'],
    result: 'u32',
    name: 'fs_add'
  },
  add_slow: {
    parameters: ['u32', 'u32'],
    result: 'u32',
    name: 'fs_add',
    nofast: true
  }
}

const preamble = `
static uint32_t fs_add (uint32_t a, uint32_t b) {
  return a + b;
}
`

const name = 'fastsnap'

export { name, api, preamble }
