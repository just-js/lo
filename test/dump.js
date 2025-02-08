import { mem } from 'lib/proc.js'
import { extName } from 'lib/path.js'

const { args, start, colors } = lo
const { AD, AY, AG, AM, AC } = colors

function dump_object (obj, name) {
  console.log(`------------------------
        ${AM}${name}${AD}
------------------------`)
  const entries = Object.entries(obj)
  entries.sort((a, b) => a < b ? -1 : (a === b ? 0 : 1))
  for (const [key, value] of entries) {
    if (value === undefined) {
      console.log(`${AC}${key}${AD}: undefined`)
      continue
    }
    if (['AsyncFunction', 'Function', 'Object'].includes(value.constructor.name)) {
      console.log(`${AC}${key}${AD}: ${value.constructor.name}`)
    } else if (['String'].includes(value.constructor.name)) {
      console.log(`${AC}${key}${AD}: ${value.constructor.name}`)
    } else if (['Array'].includes(value.constructor.name)) {
      console.log(`${AC}${key}${AD}: ${value.constructor.name} = [ ${value.join(', ')} ]`)
    } else {
      console.log(`${AY}${key}${AD}: ${value.constructor.name} = ${value}`)
    }
  }
}

async function test () {
  const os = lo.os()
  const arch = lo.arch()
  const elapsed = lo.hrtime() - start
  console.log(`------------------------
        ${AY}lo.js${AD}
------------------------`)
  console.log(`${AG}args${AD}       ${args}`)  
  console.log(`${AG}tests${AD}      ok`)
  console.log(`${AG}os${AD}         ${os}  
${AG}arch${AD}       ${arch}  
${AG}boot${AD}       ${(elapsed / 1000000).toFixed(2)} ms  
${AG}version${AD}    ${lo.version.lo}  
${AG}rss${AD}        ${mem()}  
${AG}v8${AD}         ${lo.version.v8}`)
  dump_object(lo, 'lo')
  console.log(`${AG}builtins${AD}`)
  const builtins = lo.builtins()
  for (const builtin of builtins) {
    console.log(`  ${AM}${builtin.padEnd(32, ' ')}${AD}: ${lo.builtin(builtin).length} bytes`)
    if (extName(builtin) === 'js' && builtin !== 'main.js') {
      try {
        const lib = await import(builtin)
        dump_object(lib, builtin)
      } catch (err) {
        lo.handle_error(err)
      }
    }
  }
  console.log(`${AG}bindings${AD}`)
  for (const lib_name of lo.libraries().sort()) {
    const lib = lo.load(lib_name)
    const binding = lib[lib_name]
    dump_object(binding, lib_name)
  }
}

export { test }
