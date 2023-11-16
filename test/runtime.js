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
  ]
  for (const name of names) {
    assert(lo.hasOwnProperty(name))
    assert(lo[name].constructor.name === 'Function')
  }
  console.log(`${AG}tests${AD}      ok`)
  console.log(`${AG}os${AD}         ${os}  
${AG}arch${AD}       ${arch}  
${AG}boot${AD}       ${(elapsed / 1000000).toFixed(2)} ms  
${AG}version${AD}    ${lo.version.lo}  
${AG}v8${AD}         ${lo.version.v8}`)
  console.log(`${AG}builtins${AD}`)
  const builtins = lo.builtins().map(n => ({ name: n, src: lo.builtin(n)})).sort((a, b) => b.src.length - a.src.length)
  for (const builtin of builtins) {
    console.log(`  ${AM}${builtin.name.padEnd(32, ' ')}${AD}: ${builtin.src.length} bytes`)
  }
  console.log(`${AG}bindings${AD}`)
  for (const lib_name of lo.libraries()) {
    console.log(`  ${AY}${lib_name}${AD}`)
    const lib = lo.library(lib_name)
    assert(lib)
    assert(lib.hasOwnProperty(lib_name))
    const bindings = await import(`lib/${lib_name}/api.js`)
    const binding = lib[lib_name]
    for (const fn_name of Object.keys(bindings.api)) {
      const api = bindings.api[fn_name]
      const descriptor = Object.getOwnPropertyDescriptor(binding, fn_name)
      const prop = binding[fn_name]
      console.log(`    ${AC}${fn_name}${AD} (${prop.constructor.name})`)
      //console.log(JSON.stringify({ descriptor, api }, null, '  '))
    }
  }
}

export { test }
