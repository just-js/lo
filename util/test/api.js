if (!globalThis.spin) throw new Error('spin does not exists on globalThis')
if (!spin.assert) throw new Error('assert does not exist on globalThis.spin')

const { assert } = spin

assert(spin.version, `spin.version does not exist`)
assert(spin.version.spin, 'spin.version.spin does not exist')
assert(spin.version.v8, 'spin.version.v8 does not exist')

const natives = [ 
  'bindFastApi', 'nextTick', 'runMicroTasks', 'builtin', 'library', 'builtins', 
  'modules', 'setModuleCallbacks', 'loadModule', 'evaluateModule', 'utf8Decode', 
  'hrtime', 'utf8Length', 'utf8EncodeInto', 'getAddress', 'readMemory'
]

for (const name of natives) {
  const fn = spin[name]
  assert(fn, `spin.${name}() does not exist`)
  assert(fn.name === name, `spin.${name}() name does not match, got ${fn.name}`)
  assert(fn.constructor.name === 'Function', `spin.${name}() is not a function, got ${fn.constructor.name}`)
}

assert(spin.colors, `spin.colors does not exist`)
assert(Object.getOwnPropertyDescriptor(spin, 'errno'), 'spin.errno does not exist')
assert(Object.getOwnPropertyDescriptor(spin, 'errno').enumerable, 'spin.errno is not enumerable')
assert(!Object.getOwnPropertyDescriptor(spin, 'errno').configurable, 'spin.errno is configurable')
assert(spin.errno.constructor.name === 'Number', 'spin.errno is not a Number')
