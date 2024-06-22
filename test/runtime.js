import { extName } from 'lib/path.js'

const { assert, colors } = lo

async function test () {
  const names = [
    'nextTick', 'print', 'registerCallback', 'runMicroTasks', 'builtin', 
    'builtins', 'libraries', 'setModuleCallbacks', 'loadModule', 
    'evaluateModule', 'latin1Decode', 'utf8Decode', 'utf8Encode', 'wrapMemory', 
    'unwrapMemory', 'setFlags', 'get_meta', 'runScript', 'arch', 'os', 'hrtime', 
    'getAddress', 'utf8Length', 'utf8EncodeInto', 'utf8EncodeIntoAtOffset', 
    'readMemory', 'readMemoryAtOffset'
  ].sort()
  assert(lo.colors)
  assert(lo.start)
  assert(lo.args.length === 2)
  for (const name of names) {
    assert(lo.hasOwnProperty(name))
    assert(lo[name].constructor.name === 'Function')
  }
  const os = lo.os()
  assert(['win', 'mac', 'linux'].includes(os))
  const arch = lo.arch()
  assert(['x64', 'arm64'].includes(arch))
  assert(lo.hasOwnProperty('version'))
  assert(lo.version.constructor.name === 'Object')
  assert(lo.version.hasOwnProperty('lo'))
  assert(lo.version.hasOwnProperty('v8'))
  assert(lo.version.lo.constructor.name === 'String')
  assert(lo.version.v8.constructor.name === 'String')
  assert(lo.hasOwnProperty('errno'))
  lo.errno = 0
  assert(lo.errno === 0)
  const builtins = lo.builtins()
  for (const name of builtins) {
    if (extName(name) === 'js' && name !== 'main.js') {
      const builtin = await import(name)
      assert(builtin)
      const entries = Object.entries(builtin)
      assert(entries.length)
    }
  }
  const bindings = lo.libraries()
  for (const name of bindings) {
    const binding = lo.load(name)
    assert(binding)
    assert(binding.hasOwnProperty(name))
    assert(binding[name])
    const entries = Object.entries(binding[name])
    assert(entries.length)
  }

  // test nextTick
  let test_val = 0
  lo.nextTick(() => {
    assert(test_val === 0)
    test_val = 1
  })
  lo.nextTick(() => assert(test_val === 1))
}

export { test }
