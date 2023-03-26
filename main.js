const AD = '\u001b[0m' // ANSI Default
const A0 = '\u001b[30m' // ANSI Black
const AR = '\u001b[31m' // ANSI Red
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow
const AB = '\u001b[34m' // ANSI Blue
const AM = '\u001b[35m' // ANSI Magenta
const AC = '\u001b[36m' // ANSI Cyan
const AW = '\u001b[37m' // ANSI White

spin.colors = { AD, A0, AR, AG, AY, AB, AM, AC, AW }

const { fs } = spin.library('fs')

const STDIN = 0
const STDOUT = 1
const STDERR = 2

globalThis.console = {
  log: str => fs.write_string(STDOUT, `${str}\n`),
  error: str => fs.write_string(STDERR, `${str}\n`)
}

globalThis.onUnhandledRejection = err => {
  console.error(`${AR}Unhandled Rejection${AD}`)
  console.error(err.message)
  console.error(err.stack)
}

const { utf8Length, utf8EncodeInto } = spin

class TextEncoder {
  encoding = 'utf-8'

  encode (input = '') {
    const u8 = new Uint8Array(utf8Length(input))
    utf8EncodeInto(input, u8)
    return u8
  }

  encodeInto (src, dest) {
    // todo: pass a u32array(2) handle in here so we can return read, written
    return utf8EncodeInto(src, dest)
  }
}

globalThis.TextEncoder = TextEncoder

class TextDecoder {
  encoding = 'utf-8'

  decode (u8) {
    if (!u8.ptr) ptr(u8)
    return spin.utf8Decode(u8.ptr, u8.size)
  }
}

globalThis.TextDecoder = TextDecoder

function wrap (h, fn, plen = 0) {
  const call = fn
  const params = (new Array(plen)).fill(0).map((_, i) => `p${i}`).join(', ')
  const f = new Function(
    'h',
    'call',
    `return function ${fn.name} (${params}) {
    call(${params}${plen > 0 ? ', ' : ''}h);
    return h[0] + ((2 ** 32) * h[1]);
  }`,)
  return f(h, call)
}

// todo: this is going to be the address of the underlying arraybuffer data,
// need to apply the u8 offset
function ptr (u8) {
  u8.ptr = spin.getAddress(u8)
  u8.size = u8.byteLength
  return u8
}

const encoder = new TextEncoder()

function C (str) {
  return ptr(encoder.encode(`${str}\0`))
}

function addr (u32) {
  return u32[0] + ((2 ** 32) * u32[1])  
}

function readFileBytes (path, flags = O_RDONLY) {
  const fd = fs.open(C(path).ptr, flags)
  spin.assert(fd > 0)
  let r = fs.fstat(fd, stat.ptr)
  spin.assert(r === 0)
  const size = Number(st[6])
  const buf = ptr(new Uint8Array(size))
  let off = 0
  let len = fs.read(fd, buf.ptr, buf.byteLength)
  while (len > 0) {
    off += len
    if (off === size) break
    len = fs.read(fd, buf.ptr, buf.byteLength)
  }
  off += len
  r = fs.close(fd)
  spin.assert(r === 0)
  spin.assert(off >= size)
  return buf
}

const libCache = new Map()

function load (name) {
  if (libCache.has(name)) return libCache.get(name)
  let lib = spin.library(name)
  if (lib) {
    libCache.set(name, lib)
    return lib
  }
  const handle = spin.dlopen(`module/${name}/${name}.so`, 1)
  if (!handle) return
  const sym = spin.dlsym(handle, `_register_${name}`)
  if (!sym) return
  lib = spin.library(sym)
  if (!lib) return
  libCache.set(name, lib)
  return lib
}

function assert (condition, message, ErrorType = Error) {
  if (!condition) {
    throw new ErrorType(message || "Assertion failed")
  }
}

async function main () {
  if (spin.args[1] === 'eval') return (new Function(`return (${spin.args[2]})`))()
  const { main, serve, test, bench } = await import(spin.args[1])
  if (test) {
    await test(...spin.args.slice(2))
  }
  if (bench) {
    await bench(...spin.args.slice(2))
  }
  if (main) {
    await main(...spin.args.slice(2))
  }
  if (serve) {
    await serve(...spin.args.slice(2))
  }
}

const decoder = new TextDecoder()
// todo: strip out any command line switches
// todo: handle errors
async function onModuleLoad (specifier, resource) {
  if (!specifier) return
  if (moduleCache.has(specifier)) {
    const mod = moduleCache.get(specifier)
    if (!mod.evaluated) {
      mod.namespace = await spin.evaluateModule(mod.scriptId)
      mod.evaluated = true
    }
    return mod.namespace
  }
  let src = spin.builtin(specifier)
  if (!src) {
    src = decoder.decode(readFileBytes(specifier))
  }
  const mod = spin.loadModule(src, specifier)
  mod.resource = resource
  moduleCache.set(specifier, mod)
  const { requests } = mod
  for (const request of requests) {
    let src = spin.builtin(request)
    if (!src) {
      src = decoder.decode(readFileBytes(request))
    }
    const mod = spin.loadModule(src, request)
    moduleCache.set(request, mod)
  }
  if (!mod.evaluated) {
    mod.namespace = await spin.evaluateModule(mod.scriptId)
    mod.evaluated = true
  }
  return mod.namespace
}

function onModuleInstantiate (specifier) {
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier).scriptId
  }
  throw new Error(`${specifier} not found`)
}

const O_RDONLY = 0
const moduleCache = new Map()
const loader = spin.library('load')
spin.fs = fs
spin.fs.readFileBytes = readFileBytes
spin.load = load
const handle = new Uint32Array(2)
spin.hrtime = wrap(handle, spin.hrtime)
spin.getAddress = wrap(handle, spin.getAddress, 1)
spin.dlopen = wrap(handle, loader.load.dlopen, 2)
spin.dlsym = wrap(handle, loader.load.dlsym, 2)
spin.dlclose = loader.load.dlclose
const stat = ptr(new Uint8Array(160))
const st = new BigUint64Array(stat.buffer)
spin.assert = assert
spin.moduleCache = moduleCache
spin.wrap = wrap
spin.cstr = C
spin.ptr = ptr
spin.addr = addr
spin.setModuleCallbacks(onModuleLoad, onModuleInstantiate)

if (spin.args[1] === 'gen') {
  const {
    bindings, linkerScript, headerFile, makeFile
  } = await import('lib/gen.js')
  let source = ''
  if (spin.args[2] === '--link') {
    source += await linkerScript('main.js')
    for (const fileName of spin.args.slice(3)) {
      source += await linkerScript(fileName)
    }
  } else if (spin.args[2] === '--header') {
    source = await headerFile(spin.args.slice(3))
  } else if (spin.args[2] === '--make') {
    source = await makeFile(spin.args[3])
  } else {
    source = await bindings(spin.args[2])
  }
  console.log(source)
} else {
  if (spin.args.length > 1) await main(...spin.args.slice(1))
}
