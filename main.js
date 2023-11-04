const { fs } = spin.library('fs')
const loader = spin.library('load')

const { utf8Length, utf8EncodeInto, wrapMemory, utf8Encode } = spin

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

const STDIN = 0
const STDOUT = 1
const STDERR = 2

const O_RDONLY = 0
const O_WRONLY = 1
const O_CREAT = 64
const O_TRUNC = 512

const S_IRUSR = 256
const S_IWUSR = 128
const S_IRGRP = S_IRUSR >> 3
const S_IROTH = S_IRGRP >> 3

const defaultWriteFlags = O_WRONLY | O_CREAT | O_TRUNC
const defaultWriteMode = S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH

//const { toUtf8, fromUtf8, isOneByte } = globalThis
//delete globalThis.toUtf8
//delete globalThis.fromUtf8
//delete globalThis.isOneByte
//const utf8Encode = input => new Uint8Array(toUtf8(input))

globalThis.console = {
  log: str => fs.write_string(STDOUT, `${str}\n`),
  error: str => fs.write_string(STDERR, `${str}\n`)
}

globalThis.onUnhandledRejection = err => {
  console.error(`${AR}Unhandled Rejection${AD}`)
  console.error(err.stack)
}

class TextEncoder {
  encoding = 'utf-8'

  encode (input = '') {
    // todo: empty string
    // todo: result cache
    return utf8Encode(input)
  }

  encodeInto (src, dest) {
    // todo: pass a u32array(2) handle in here so we can return read, written
    return utf8EncodeInto(src, dest)
  }
}

class TextDecoder {
  encoding = 'utf-8'

  decode (u8) {
    // todo: result cache
    if (!u8.ptr) ptr(u8)
    return spin.utf8Decode(u8.ptr, u8.size)
  }
}

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
  const fun = f(h, call)
  if (fn.state) fun.state = fn.state
  return fun
}

// todo: this is going to be the address of the underlying arraybuffer data,
// need to apply the u8 offset
function ptr (u8) {
  u8.ptr = spin.getAddress(u8)
  u8.size = u8.byteLength
  return u8
}

function C (str) {
  const buf = ptr(encoder.encode(`${str}\0`))
  buf.size = buf.size - 1
  return buf
}

function addr (u32) {
  return u32[0] + ((2 ** 32) * u32[1])  
}

function readFile (path, flags = O_RDONLY) {
  const fd = fs.open(path, flags)
  assert(fd > 0, `failed to open ${path} with flags ${flags}`)
  let r = fs.fstat(fd, stat)
  assert(r === 0)
  const size = Number(st[6])
  const buf = new Uint8Array(size)
  let off = 0
  let len = fs.read(fd, buf, size)
  while (len > 0) {
    off += len
    if (off === size) break
    len = fs.read(fd, buf, size)
  }
  off += len
  r = fs.close(fd)
  assert(r === 0)
  assert(off >= size)
  return buf
}

function writeFile (path, u8, flags = defaultWriteFlags, mode = defaultWriteMode) {
  const len = u8.length
  if (!len) return -1
  const fd = fs.open(path, flags, mode)
  assert(fd > 0)
  const chunks = Math.ceil(len / 4096)
  let total = 0
  let bytes = 0
  for (let i = 0, off = 0; i < chunks; ++i, off += 4096) {
    const towrite = Math.min(len - off, 4096)
    bytes = fs.write(fd, u8.subarray(off, off + towrite), towrite)
    if (bytes <= 0) break
    total += bytes
  }
  assert(bytes > 0)
  fs.close(fd)
  return total
}

function load (name) {
  if (libCache.has(name)) return libCache.get(name)
  let lib = spin.library(name)
  if (lib) {
    lib.internal = true
    libCache.set(name, lib)
    return lib
  }
  const handle = spin.dlopen(`module/${name}/${name}.so`, 1)
  if (!handle) return
  const sym = spin.dlsym(handle, `_register_${name}`)
  if (!sym) return
  lib = spin.library(sym)
  if (!lib) return
  lib.fileName = `module/${name}/${name}.so`
  libCache.set(name, lib)
  return lib
}

function assert (condition, message, ErrorType = Error) {
  if (!condition) {
    if (message && message.constructor.name === 'Function') {
      throw new ErrorType(message())
    }
    throw new ErrorType(message || "Assertion failed")
  }
  return condition
}

async function globalMain () {
  if (spin.args[1] === 'eval') return (new Function(`return (${spin.args[2]})`))()
  let filePath = spin.args[1]
  if (spin.workerSource) filePath = 'thread.js'
  const { main, serve, test, bench } = await import(filePath)
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

function loadSource (specifier) {
  let src = spin.builtin(specifier)
  if (!src) {
    src = decoder.decode(readFile(specifier))
  }
  return src
}

async function onModuleLoad (specifier, resource) {
  if (!specifier) return
  if (moduleCache.has(specifier)) {
    const mod = moduleCache.get(specifier)
    if (!mod.evaluated) {
      //console.log(`main.evaluateModule.1 ${mod.identity} ${specifier} ${resource}`)
      mod.namespace = await spin.evaluateModule(mod.identity)
      mod.evaluated = true
    }
    return mod.namespace
  }
  const src = loadSource(specifier)
  const mod = spin.loadModule(src, specifier)
  mod.resource = resource
  moduleCache.set(specifier, mod)
  const { requests } = mod
  for (const request of requests) {
    const src = loadSource(request)
    const mod = spin.loadModule(src, request)
    moduleCache.set(request, mod)
  }
  if (!mod.evaluated) {
    //console.log(`main.evaluateModule.2 ${mod.identity} ${specifier} ${resource}`)
    mod.namespace = await spin.evaluateModule(mod.identity)
    mod.evaluated = true
  }
  return mod.namespace
}

function onModuleInstantiate (specifier) {
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier).identity
  }
  const src = loadSource(specifier)
  const mod = spin.loadModule(src, specifier)
  moduleCache.set(specifier, mod)
  return mod.identity
}

function require (fileName) {
  if (requireCache.has(fileName)) {
    return requireCache.get(fileName).exports
  }
  const src = loadSource(fileName)
  const f = new Function('exports', 'module', 'require', src)
  const mod = { exports: {} }
  f.call(globalThis, mod.exports, mod, require)
  moduleCache.set(fileName, mod)
  return mod.exports
}

const _builtin = spin.builtin
spin.builtin = fp => {
  // todo - fix this hardcoding of name
  if (fp === 'thread.js') return spin.workerSource
  return _builtin(fp)
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const handle = new Uint32Array(2)
const stat = new Uint8Array(160)
const st = new BigUint64Array(stat.buffer)
const moduleCache = new Map()
const requireCache = new Map()
const libCache = new Map()

globalThis.require = require
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder

spin.utf8Encode = utf8Encode
//spin.isOneByte = isOneByte
spin.handle = handle
spin.fs = fs
spin.fs.readFile = readFile
spin.fs.writeFile = writeFile
spin.load = load
spin.hrtime = wrap(handle, spin.hrtime)
spin.getAddress = wrap(handle, spin.getAddress, 1)
spin.dlopen = wrap(handle, loader.load.dlopen, 2)
spin.dlsym = wrap(handle, loader.load.dlsym, 2)
spin.dlclose = loader.load.dlclose
spin.assert = assert
spin.moduleCache = moduleCache
spin.libCache = libCache
spin.requireCache = requireCache
spin.wrap = wrap
// todo: change anywhere that uses this
//spin.wrapMemory = (ptr, len, free = 0) => new Uint8Array(wrapMemory(ptr, len, free))
spin.cstr = C
spin.ptr = ptr
spin.addr = addr
// so we can override
spin.onModuleLoad = onModuleLoad
spin.onModuleInstantiate = onModuleInstantiate
spin.setModuleCallbacks(onModuleLoad, onModuleInstantiate)

// Object.freeze(spin)
// TODO: freeze intrinsics - maybe make these optional so can be overriden with cli flags/env vars?
if (spin.args[1] === 'gen') {
  const {
    bindings, linkerScript, headerFile, makeFile
  } = await import('lib/gen.js')
  let source = ''
  if (spin.args[2] === '--link') {
    source += linkerScript('main.js')
    for (const fileName of spin.args.slice(3)) {
      source += linkerScript(fileName)
    }
  } else if (spin.args[2] === '--header') {
    source = headerFile(spin.args.slice(3))
  } else if (spin.args[2] === '--make') {
    source = await makeFile(spin.args[3])
  } else {
    source = await bindings(spin.args[2])
  }
  console.log(source)
} else {
  if (spin.workerSource) {
    import('thread.js')
      .catch(err => console.error(err.stack))
  } else {
    globalMain().catch(err => console.error(err.stack))
  }
}

export {}
