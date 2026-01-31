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
      const sym = assert(c_compiler.symbol(def.name || name) ||  dlsym(0, def.name || name))
      binding[name] = bind(sym, def.result, def.parameters)
      binding[name].sym = sym
      continue
    }
    if (def === 'u32') {
      const sym = assert(c_compiler.symbol(name))
      binding[name] = (new Uint32Array(wrap_memory(sym, 4, 0)))[0]
      binding[name].sym = sym
    }
  }
  return binding
}

export { C, c_compiler }
