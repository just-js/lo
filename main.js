
// global classes

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

// externally exposed functions

function assert (condition, message, ErrorType = Error) {
  if (!condition) {
    if (message && message.constructor.name === 'Function') {
      throw new ErrorType(message())
    }
    throw new ErrorType(message || "Assertion failed")
  }
  return condition
}

function wrap (handle, fn, plen = 0) {
  const call = fn
  const params = (new Array(plen)).fill(0).map((_, i) => `p${i}`).join(', ')
  // TODO: Number.IsSafeInteger check - return BigInt if not safe
  const f = new Function(
    'handle',
    'call',
    `return function ${fn.name} (${params}) {
    call(${params}${plen > 0 ? ', ' : ''}handle);
    return handle[0] + ((2 ** 32) * handle[1]);
  }`,)
  const fun = f(handle, call)
  if (fn.state) fun.state = fn.state
  return fun
}

function ptr (u8) {
  u8.ptr = lo.getAddress(u8)
  u8.size = u8.byteLength
  return u8
}

function cstr (str) {
  const buf = ptr(encoder.encode(`${str}\0`))
  buf.size = buf.size - 1
  return buf
}

function addr (u32) {
  return u32[0] + ((2 ** 32) * u32[1])  
}

function read_file (path, flags = O_RDONLY) {
  const fd = open(path, flags)
  assert(fd > 0, `failed to open ${path} with flags ${flags}`)
  let r = fstat(fd, stat)
  assert(r === 0)
  let size = 0
  if (core.os === 'mac') {
    size = Number(st[12])
  } else {
    size = Number(st[6])
  }
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

function write_file (path, u8, flags = defaultWriteFlags, 
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
  // todo: we leak this handle - need to be able to unload
  const handle = core.dlopen(`lib/${name}/${name}.so`, 1)
  if (!handle) return
  const sym = core.dlsym(handle, `_register_${name}`)
  if (!sym) return
  lib = library(sym)
  if (!lib) return
  lib.fileName = `lib/${name}/${name}.so`
  libCache.set(name, lib)
  return lib
}

// internal functions

// todo: expose this to JS so it can be overridden
function load_source (specifier) {
  let src = ''
  if (!builtins.includes(specifier)) {
    src = decoder.decode(read_file(`${LO_HOME}${specifier}`))
  }
  src = assert(lo.builtin(specifier))
  return src
}

async function on_module_load (specifier, resource) {
  if (!specifier) return
  if (moduleCache.has(specifier)) {
    const mod = moduleCache.get(specifier)
    if (!mod.evaluated) {
      mod.namespace = await evaluateModule(mod.identity)
      mod.evaluated = true
    }
    return mod.namespace
  }
  // todo: allow overriding loadSource - return a promise
  const src = load_source(specifier)
  const mod = loadModule(src, specifier)
  mod.resource = resource
  moduleCache.set(specifier, mod)
  const { requests } = mod
  for (const request of requests) {
    const src = load_source(request)
    const mod = loadModule(src, request)
    moduleCache.set(request, mod)
  }
  if (!mod.evaluated) {
    mod.namespace = await evaluateModule(mod.identity)
    mod.evaluated = true
  }
  return mod.namespace
}

function on_module_instantiate (specifier) {
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier).identity
  }
  const src = load_source(specifier)
  const mod = loadModule(src, specifier)
  moduleCache.set(specifier, mod)
  return mod.identity
}

/**
* an approximation of node.js synchronous require. not sure if this should
* be here at all but it's useful for compatibility testing
* ```
* @param file_path {string} path to the file to be required
*/
function require (file_path) {
  if (requireCache.has(file_path)) {
    return requireCache.get(file_path).exports
  }
  const src = load_source(file_path)
  const f = new Function('exports', 'module', 'require', src)
  const mod = { exports: {} }
  f.call(globalThis, mod.exports, mod, require)
  moduleCache.set(file_path, mod)
  return mod.exports
}

/**
* handle any exceptions in async code that did not have a handler
* the best thing to do is die gracefully and log as much as possible
* we should make what happens here configurable
* @param err { Error } a javascript Error object
*/
function on_unhandled_rejection (err) {
  console.error(`${AR}Unhandled Rejection${AD}`)
  die(err, true)
}

function on_load_builtin (identifier) {
  if (identifier === '@workerSource') return workerSource
  return builtin(identifier)
}

function wrap_getenv () {
  const getenv = wrap(new Uint32Array(2), core.getenv, 1)
  return str => {
    const ptr = getenv(str)
    if (!ptr) return ''
    return lo.utf8Decode(ptr, -1)
  }
}

function die (err, hide_fatal = false) {
  if (!hide_fatal) console.error(`${AR}Fatal Exception${AD}`)
  console.error(err.stack)
  console.error(`${AY}process will exit${AD}`)
  lo.exit(1)
}

const { 
  utf8EncodeInto, utf8Encode, utf8Decode, getAddress, args, exit, builtin,
  library, workerSource, loadModule, evaluateModule, hrtime, wrapMemory
} = lo
const { core } = library('core')
const {
  O_WRONLY, O_CREAT, O_TRUNC, O_RDONLY, S_IWUSR, S_IRUSR, S_IRGRP, S_IROTH,
  STDIN, STDOUT, STDERR
} = core
const {
  write_string, open, fstat, read, write, close
} = core
const AD = '\u001b[0m' // ANSI Default
const A0 = '\u001b[30m' // ANSI Black
const AR = '\u001b[31m' // ANSI Red
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow
const AB = '\u001b[34m' // ANSI Blue
const AM = '\u001b[35m' // ANSI Magenta
const AC = '\u001b[36m' // ANSI Cyan
const AW = '\u001b[37m' // ANSI White
const defaultWriteFlags = O_WRONLY | O_CREAT | O_TRUNC
const defaultWriteMode = S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const handle = new Uint32Array(2)
const stat = new Uint8Array(160)
const st = new BigUint64Array(stat.buffer)
const moduleCache = new Map()
const requireCache = new Map()
const libCache = new Map()
// todo: check errors
globalThis.console = {
  log: str => write_string(STDOUT, `${str}\n`),
  error: str => write_string(STDERR, `${str}\n`)
}
globalThis.onUnhandledRejection = on_unhandled_rejection
globalThis.require = require
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder
lo.colors = { AD, A0, AR, AG, AY, AB, AM, AC, AW }
lo.builtin = on_load_builtin
lo.utf8Encode = utf8Encode
lo.load = load
lo.hrtime = wrap(handle, hrtime, 0)
lo.getAddress = wrap(handle, getAddress, 1)
lo.assert = assert
lo.moduleCache = moduleCache
lo.libCache = libCache
lo.requireCache = requireCache
lo.wrap = wrap
lo.wrapMemory = (ptr, len, free = 0) => 
  new Uint8Array(wrapMemory(ptr, len, free))
lo.cstr = cstr
lo.ptr = ptr
lo.addr = addr
lo.core = core
lo.getenv = wrap_getenv()
const LO_HOME = lo.getenv('LO_HOME')
//const module_caching = parseInt(lo.getenv('LO_CACHE') || '0', 10)
core.dlopen = wrap(handle, core.dlopen, 2)
core.dlsym = wrap(handle, core.dlsym, 2)
core.mmap = wrap(handle, core.mmap, 6)
core.readFile = read_file
core.writeFile = write_file
// todo: move os() and arch() to a binding
// todo: optimize this - return numbers and make a single call to get both
core.os = lo.os()
core.arch = lo.arch()
lo.setModuleCallbacks(on_module_load, on_module_instantiate)

const builtins = lo.builtins()
const libraries = lo.libraries()

async function global_main () {
  if (args[1] === 'gen') {
    (await import('lib/gen.js')).gen(lo.args.slice(2))
  } else {
    if (workerSource) {
      import('@workerSource')
        .catch(die)
    } else {
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
  }
}

global_main().catch(die)

export {}
