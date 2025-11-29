import { bind } from 'lib/ffi.js'
import * as tcc from 'lib/tcc.js'

const { assert, wrap_memory, core } = lo
const { dlsym } = core

const c_compiler = new tcc.Compiler()

function C (...args) {
  let extern
  let src
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.constructor.name === 'Array') {
      src = arg[1]
    } else if (arg.constructor.name === 'Object') {
      extern = arg
    }
  }
  c_compiler.compile(src)
  const binding = {}
  for (const name of Object.keys(extern)) {
    const def = extern[name]
    if (def.constructor.name !== 'String') {
      binding[name] = bind(assert(c_compiler.symbol(def.name || name) || 
        dlsym(0, def.name || name)), def.result, def.parameters)
      continue
    }
    if (def === 'u32') {
      binding[name] = (new Uint32Array(wrap_memory(assert(
          c_compiler.symbol(name)), 4, 0)))[0]
    }
  }
  return binding
}

export { C }
