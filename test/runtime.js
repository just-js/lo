import { mem } from 'lib/proc.js'

const os = lo.os()
const arch = lo.arch()

const { assert, args, start, colors } = lo
const { AD, AY, AG, AM, AC } = colors

async function test () {
  const elapsed = lo.hrtime() - start
  console.log(`------------------------
        ${AY}lo.js${AD}
------------------------`)
  console.log(`${AG}args${AD}       ${args}`)  
  if (os === 'win') {
    //assert(args[0] === './lo.exe' || args[0] === 'lo.exe' || args[0] === 'lo' 
    //  || args[0] === './lo')
  } else {
    //assert(args[0] === './lo' || args[0] === 'lo')
    assert(start > 0)
    assert(lo.hrtime() > start)
  }
  assert(lo.hasOwnProperty('version'))
  assert(lo.version.constructor.name === 'Object')
  assert(lo.version.hasOwnProperty('lo'))
  assert(lo.version.hasOwnProperty('v8'))
  assert(lo.version.lo.constructor.name === 'String')
  assert(lo.version.v8.constructor.name === 'String')
  assert(lo.hasOwnProperty('errno'))
  lo.errno = 0
  assert(lo.errno === 0)
  const names = [
    'nextTick', 'print', 'registerCallback', 'runMicroTasks', 'builtin', 
    'library', 'builtins', 'libraries', 'setModuleCallbacks', 'loadModule', 
    'evaluateModule', 'utf8Decode', 'utf8Encode', 'wrapMemory', 'unwrapMemory', 
    'setFlags', 'getMeta', 'runScript', 'arch', 'os', 'hrtime', 'getAddress', 
    'utf8Length', 'utf8EncodeInto', 'utf8EncodeIntoAtOffset', 'readMemory', 
    'readMemoryAtOffset'
  ].sort()
  for (const name of names) {
    assert(lo.hasOwnProperty(name))
    assert(lo[name].constructor.name === 'Function')
  }
  console.log(`${AG}tests${AD}      ok`)
  console.log(`${AG}os${AD}         ${os}  
${AG}arch${AD}       ${arch}  
${AG}boot${AD}       ${(elapsed / 1000000).toFixed(2)} ms  
${AG}version${AD}    ${lo.version.lo}  
${AG}rss${AD}        ${mem()}  
${AG}v8${AD}         ${lo.version.v8}`)
  console.log(`${AG}builtins${AD}`)
  const builtins = lo.builtins().sort()
  for (const builtin of builtins) {
    console.log(`  ${AM}${builtin.padEnd(32, ' ')}${AD}: ${lo.builtin(builtin).length} bytes`)
  }
  console.log(`${AG}bindings${AD}`)
  for (const lib_name of lo.libraries().sort()) {
    console.log(`  ${AY}${lib_name}${AD}`)
    const lib = lo.library(lib_name)
    assert(lib)
    assert(lib.hasOwnProperty(lib_name))
    const binding = lib[lib_name]
    const entries = Object.entries(binding)
    entries.sort((a, b) => a < b ? -1 : (a === b ? 0 : 1))
    for (const [key, value] of entries) {
      if (['Function', 'Object'].includes(value.constructor.name)) {
        console.log(`    ${AC}${key}${AD}: ${value.constructor.name}`)
      } else {
        console.log(`    ${AY}${key}${AD}: ${value.constructor.name} = ${value}`)
      }
    }
  }
}

export { test }
