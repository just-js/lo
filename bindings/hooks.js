import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { registerHooks } = require('node:module');

function resolve(specifier, context, nextResolve) {
  if (typeof specifier === 'string' && specifier.startsWith('lib/')) {
    const url = `lo:${specifier}`;
    return {
      shortCircuit: true,
      url,
    };
  }
  return nextResolve(specifier, context);
}

function load(url, context, nextLoad) {
  if (url.startsWith('lo:')) {
    const name = url.split('lo:')[1];
    return {
      format: "module",
      source: lo.builtin(name),
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}

function fix_stack (err) {
  err.stack = err.stack.split('\n')
    .filter(line => !line.match(/\s+at assert \(main\.js.+/))
    .join('\n')
}

function wrap (handle, fn, plen = 0) {
  if (!handle.ptr) ptr(handle)
  const call = fn
  const params = (new Array(plen)).fill(0).map((_, i) => `p${i}`).join(', ')
  // TODO: Number.IsSafeInteger check - return BigInt if not safe
  const f = new Function(
    'handle',
    'call',
    `return function ${fn.name} (${params}) {
    call(${params}${plen > 0 ? ', ' : ''}handle.ptr);
    return handle[0] + ((2 ** 32) * handle[1]);
  }`,)
  const fun = f(handle, call)
  if (fn.state) fun.state = fn.state
  return fun
}

function assert (condition, message, ErrorType = Error) {
  if (!condition) {
    if (message && message.constructor.name === 'Function') {
      const err = new ErrorType(message(condition))
      fix_stack(err)
      throw(err)
    }
    const err = new ErrorType(message || "Assertion failed")
    fix_stack(err)
    throw(err)
  }
  return condition
}

function addr (u32) {
  return u32[0] + ((2 ** 32) * u32[1])  
}

function get_address (buf) {
  getAddress(buf, handle)
  return addr(handle)
}

function ptr (u8) {
  if (u8.ptr) return u8
  u8.ptr = get_address(u8)
  return u8
}

const { lo } = require('./build/Release/lo.node')
globalThis.lo = lo
const { getAddress, hrtime } = lo
const handle = new Uint32Array(2)
handle.ptr = assert(get_address(handle))
lo.hrtime = function () {
  hrtime(handle.ptr)
  return addr(handle)
}
lo.args = process.argv
const { core } = lo.library('core')
lo.core = core

function lo_load (name) {
  if (libCache.has(name)) return libCache.get(name)
  let lib
  if (core.binding_loader) {
    lib = core.binding_loader(name)
    if (!lib) lib = library(name)
  } else {
    lib = library(name)
  }
  if (lib) {
    lib.internal = true
    libCache.set(name, lib)
    return lib
  }
  // todo: we leak this handle - need to be able to unload
  if (core.os === 'win') {
    // TODO
    return
  } else {
    const handle = core.dlopen(`lib/${name}/${name}.so`, core.RTLD_NOW) ||
      core.dlopen(`${LO_HOME}/lib/${name}/${name}.so`, core.RTLD_NOW)
    if (!handle) return
    const sym = core.dlsym(handle, `_register_${name}`)
    if (!sym) return
    lib = library(sym)
    lib.handle = handle
    if (!lib) return
  }
  lib.fileName = `lib/${name}/${name}.so`
  libCache.set(name, lib)
  return lib
}


const libCache = new Map()
const isatty = core.isatty(core.STDOUT)
const AD = isatty ? '\u001b[0m' : '' // ANSI Default
const A0 = isatty ? '\u001b[90m' : '' // ANSI Black
const AR = isatty ? '\u001b[91m' : '' // ANSI Red
const AG = isatty ? '\u001b[92m' : '' // ANSI Green
const AY = isatty ? '\u001b[93m' : '' // ANSI Yellow
const AB = isatty ? '\u001b[94m' : '' // ANSI Blue
const AM = isatty ? '\u001b[95m' : '' // ANSI Magenta
const AC = isatty ? '\u001b[96m' : '' // ANSI Cyan
const AW = isatty ? '\u001b[97m' : '' // ANSI White

lo.colors = { AD, A0, AR, AG, AY, AB, AM, AC, AW }
const { library } = lo
lo.core.arch = lo.arch()
lo.core.os = lo.os()
lo.ptr = ptr
lo.assert = assert
lo.get_address = get_address
lo.register_callback = lo.registerCallback
lo.require = require
lo.wrap = wrap
lo.utf8_length = lo.utf8Length
lo.load = lo_load
const LO_HOME = process.env.LO_HOME

registerHooks({ resolve, load });
