const AD = '\u001b[0m' // ANSI Default
const A0 = '\u001b[30m' // ANSI Black
const AR = '\u001b[31m' // ANSI Red
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow
const AB = '\u001b[34m' // ANSI Blue
const AM = '\u001b[35m' // ANSI Magenta
const AC = '\u001b[36m' // ANSI Cyan
const AW = '\u001b[37m' // ANSI White

const { 
  utf8EncodeInto, utf8Encode, utf8Decode, getAddress, start, args, exit,
  library, workerSource, loadModule, evaluateModule, hrtime, wrapMemory
} = lo
lo.colors = { AD, A0, AR, AG, AY, AB, AM, AC, AW }

const { core } = library('core')
const {
  O_WRONLY, O_CREAT, O_TRUNC, O_RDONLY, S_IWUSR, S_IRUSR, S_IRGRP, S_IROTH
} = core
const {
  write_string, open, fstat, read, write, close
} = core
const defaultWriteFlags = O_WRONLY | O_CREAT | O_TRUNC
const defaultWriteMode = S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH

const STDOUT = 1
const STDERR = 2

globalThis.console = {
  log: str => write_string(STDOUT, `${str}\n`),
  error: str => write_string(STDERR, `${str}\n`)
}

globalThis.onUnhandledRejection = err => {
  console.error(`${AR}Unhandled Rejection${AD}`)
  console.error(err.stack)
  exit(1)
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
    return utf8Decode(u8.ptr, u8.size)
  }
}

function ptr (u8) {
  u8.ptr = lo.getAddress(u8)
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
  const fd = open(path, flags)
  assert(fd > 0, `failed to open ${path} with flags ${flags}`)
  let r = fstat(fd, stat)
  assert(r === 0)
  const size = Number(st[6])
  const buf = new Uint8Array(size)
  let off = 0
  let len = read(fd, buf, size)
  while (len > 0) {
    off += len
    if (off === size) break
    len = read(fd, buf, size)
  }
  off += len
  r = close(fd)
  assert(r === 0)
  assert(off >= size)
  return buf
}

function writeFile (path, u8, flags = defaultWriteFlags, 
  mode = defaultWriteMode) {
  const len = u8.length
  if (!len) return -1
  const fd = open(path, flags, mode)
  assert(fd > 0)
  const chunks = Math.ceil(len / 4096)
  let total = 0
  let bytes = 0
  for (let i = 0, off = 0; i < chunks; ++i, off += 4096) {
    const towrite = Math.min(len - off, 4096)
    bytes = write(fd, u8.subarray(off, off + towrite), towrite)
    if (bytes <= 0) break
    total += bytes
  }
  assert(bytes > 0)
  close(fd)
  return total
}

function load (name) {
  if (libCache.has(name)) return libCache.get(name)
  let lib = library(name)
  if (lib) {
    lib.internal = true
    libCache.set(name, lib)
    return lib
  }
  const handle = lo.dlopen(`binding/${name}/${name}.so`, 1)
  if (!handle) return
  const sym = lo.dlsym(handle, `_register_${name}`)
  if (!sym) return
  lib = library(sym)
  if (!lib) return
  lib.fileName = `binding/${name}/${name}.so`
  libCache.set(name, lib)
  return lib
}

async function globalMain () {
  if (args[1] === 'eval') return (new Function(`return (${args[2]})`))()
  let filePath = args[1]
  if (workerSource) filePath = 'thread.js'
  const { main, serve, test, bench } = await import(filePath)
  if (test) {
    await test(...args.slice(2))
  }
  if (bench) {
    await bench(...args.slice(2))
  }
  if (main) {
    await main(...args.slice(2))
  }
  if (serve) {
    await serve(...args.slice(2))
  }
}

function loadSource (specifier) {
  let src = lo.builtin(specifier)
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
      mod.namespace = await evaluateModule(mod.identity)
      mod.evaluated = true
    }
    return mod.namespace
  }
  const src = loadSource(specifier)
  const mod = loadModule(src, specifier)
  mod.resource = resource
  moduleCache.set(specifier, mod)
  const { requests } = mod
  for (const request of requests) {
    const src = loadSource(request)
    const mod = loadModule(src, request)
    moduleCache.set(request, mod)
  }
  if (!mod.evaluated) {
    mod.namespace = await evaluateModule(mod.identity)
    mod.evaluated = true
  }
  return mod.namespace
}

function onModuleInstantiate (specifier) {
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier).identity
  }
  const src = loadSource(specifier)
  const mod = loadModule(src, specifier)
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

const _builtin = lo.builtin
lo.builtin = fp => {
  // todo - fix this hardcoding of name
  if (fp === 'thread.js') return workerSource
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
const os = lo.os()
const arch = lo.arch()

globalThis.require = require
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder

lo.utf8Encode = utf8Encode
lo.handle = handle
lo.core = core
core.readFile = readFile
core.writeFile = writeFile
lo.load = load
lo.hrtime = wrap(handle, hrtime)
lo.getAddress = wrap(handle, getAddress, 1)
lo.dlopen = wrap(handle, core.dlopen, 2)
lo.dlsym = wrap(handle, core.dlsym, 2)
lo.dlclose = core.dlclose
lo.assert = assert
lo.moduleCache = moduleCache
lo.libCache = libCache
lo.requireCache = requireCache
lo.wrap = wrap
lo.wrapMemory = (ptr, len, free = 0) => 
  new Uint8Array(wrapMemory(ptr, len, free))
lo.cstr = C
lo.ptr = ptr
lo.addr = addr
lo.onModuleLoad = onModuleLoad
lo.onModuleInstantiate = onModuleInstantiate
lo.setModuleCallbacks(onModuleLoad, onModuleInstantiate)

function test () {
  if (os === 'win') {
    assert(args[0] === './lo.exe' || args[0] === 'lo.exe' || args[0] === 'lo' 
      || args[0] === './lo')
  } else {
    assert(args[0] === './lo' || args[0] === 'lo')
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
  console.log(`${AM}tests${AD}   ok`)
}

function test_main () {
  const elapsed = lo.hrtime() - start
  console.log(`------------------------
        ${AY}lo.js${AD}
------------------------`)
  console.log(`${AG}args${AD}    ${args}`)  
  test()
  console.log(`${AG}os${AD}      ${os}  
${AG}arch${AD}    ${arch}  
${AG}boot${AD}    ${(elapsed / 1000000).toFixed(2)} ms  
${AG}version${AD} ${lo.version.lo}  
${AG}v8${AD}      ${lo.version.v8}`)
  for (const lib_name of lo.libraries()) {
    console.log(`${AY}${lib_name}${AD}`)
    const lib = lo.library(lib_name)
    assert(lib)
    assert(lib.hasOwnProperty(lib_name))
    console.log(Object.getOwnPropertyNames(lib[lib_name]))
  }
}

// Object.freeze(lo)
// TODO: freeze intrinsics - maybe make these optional so can be 
// overridden with cli flags/env vars?
if (args[1] === 'gen') {
  (await import('lib/gen.js')).gen(lo.args.slice(2))
} else if (args[1] === 'test') {
  test_main()
} else {
  if (workerSource) {
    import('thread.js')
      .catch(err => console.error(err.stack))
  } else {
    globalMain().catch(err => console.error(err.stack))
  }
}

export {}
