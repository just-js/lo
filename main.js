// global classes

function bootstrap_runtime () {

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
      throw new ErrorType(message(condition))
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
    const v = handle[0] + ((2 ** 32) * handle[1])
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

function check_mode (val, mode) {
  return (val & S_IFMT) === mode
}

function is_file (path) {
  const fd = open(path, O_RDONLY)
  if (fd <= 2) return false
  if (fstat(fd, stat) !== 0) return false
  close(fd)
  return check_mode(stat32[MODE_WORD], S_IFREG)
}

function read_file (path, flags = O_RDONLY, size = 0) {
  const fd = open(path, flags)
  assert(fd > 0, `failed to open ${path} with flags ${flags}`)
  if (size === 0) {
    assert(fstat(fd, stat) === 0)
    if (core.os === 'mac') {
      size = Number(st[12])
    } else {
      size = Number(st[6])
    }
  }
  let off = 0
  let len = 0
  // todo - check for max size
  const u8 = new Uint8Array(size)
  while ((len = read(fd, u8, size - off)) > 0) off += len
  close(fd)
  return u8
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

// this is called to load a binding linked into runtime or from an external
// shared library
function load (name) {
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
  const handle = core.dlopen(`lib/${name}/${name}.so`, RTLD_LAZY) ||
    core.dlopen(`${LO_HOME}/lib/${name}/${name}.so`, RTLD_LAZY)
  if (!handle) return
  const sym = core.dlsym(handle, `_register_${name}`)
  if (!sym) return
  lib = library(sym)
  lib.handle = handle
  if (!lib) return
  lib.fileName = `lib/${name}/${name}.so`
  libCache.set(name, lib)
  return lib
}

// internal functions
// this is called by the synchronous CJS require() loader
function load_source_sync (specifier) {
  let src = ''
  if (core.sync_loader) {
    src = core.sync_loader(specifier)
    if (src) return src
  }
  src = lo.builtin(specifier)
  if (!src || (LO_CACHE === 1)) {
    // todo: path.join
    try {
      src = decoder.decode(read_file(specifier))
    } catch (err) {
      src = decoder.decode(read_file(`${LO_HOME}/${specifier}`))
    }
  }
  return src
}

// this is called when async ESM modules are loaded
async function load_source (specifier) {
  let src = ''
  if (core.loader) {
    src = await core.loader(specifier)
    if (src) return src
  }
  src = lo.builtin(specifier)
  if (!src || (LO_CACHE === 1)) {
    // todo: path.join
    try {
      src = decoder.decode(read_file(specifier))
    } catch (err) {
      src = decoder.decode(read_file(`${LO_HOME}/${specifier}`))
    }
  }
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
  // todo: this should be async
  const src = await load_source(specifier)
  const mod = loadModule(src, specifier)
  mod.resource = resource
  moduleCache.set(specifier, mod)
  const { requests } = mod
  for (const request of requests) {
    const src = await load_source(request)
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
  //lo.print(`on_module_instantiate: ${specifier}\n`)
  if (moduleCache.has(specifier)) {
    return moduleCache.get(specifier).identity
  }
  // todo: why is this function synchronous only??
  const src = load_source_sync(specifier)
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
  // todo: this is now async
  const src = load_source_sync(file_path)
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
  console.error(err.stack)
  //die(err, true)
}

const builtin_cache = new Map()

function on_load_builtin (identifier) {
  if (builtin_cache.has(identifier)) return builtin_cache.get(identifier)
  if (identifier === 'worker_source.js') {
    builtin_cache.set(identifier, workerSource)
    return workerSource
  }
  builtin_cache.set(identifier, builtin(identifier))
  return builtin(identifier)
}

function wrap_getenv () {
  const getenv = wrap(handle, core.getenv, 1)
  return str => {
    const ptr = getenv(str)
    if (!ptr) return ''
//    console.error(ptr)
    const len = strnlen(ptr, MAX_ENV)
//    console.error(len === 0)
    if (len === 0) return ''
    return lo.utf8Decode(ptr, len)
  }
}

function wrap_getcwd () {
  const getcwd = wrap(handle, core.getcwd, 2)
  const cwdbuf = new Uint8Array(MAX_DIR)

  return () => {
    const ptr = getcwd(cwdbuf, cwdbuf.length)
    if (!ptr) return ''
    const len = strnlen(ptr, MAX_DIR)
    if (len === 0) return ''
    return utf8Decode(ptr, -1)
  }
}

function die (err, hide_fatal = false) {
  if (!hide_fatal) console.error(`${AR}Fatal Exception${AD}`)
  console.error(err.stack)
  console.error(`${AY}process will exit${AD}`)
  exit(1)
}

const { 
  utf8EncodeInto, utf8Encode, utf8Decode, getAddress, args, exit, builtin,
  library, workerSource, loadModule, evaluateModule, hrtime, wrapMemory
} = lo
const { core } = library('core')
const {
  O_WRONLY, O_CREAT, O_TRUNC, O_RDONLY, S_IWUSR, S_IRUSR, S_IRGRP, S_IROTH,
  S_IFREG, STDOUT, STDERR, S_IFMT, RTLD_LAZY, RTLD_NOW
} = core
const {
  write_string, open, fstat, read, write, close, strnlen
} = core

function little_endian () {
  const buffer = new ArrayBuffer(2)
  new DataView(buffer).setInt16(0, 256, true)
  return new Int16Array(buffer)[0] === 256
}

const MAX_ENV = 65536 // maximum environment variable size - todo
const MAX_DIR = 65536 // maximum path len - todo
const isatty = core.isatty(STDOUT)
const AD = isatty ? '\u001b[0m' : '' // ANSI Default
const A0 = isatty ? '\u001b[30m' : '' // ANSI Black
const AR = isatty ? '\u001b[31m' : '' // ANSI Red
const AG = isatty ? '\u001b[32m' : '' // ANSI Green
const AY = isatty ? '\u001b[33m' : '' // ANSI Yellow
const AB = isatty ? '\u001b[34m' : '' // ANSI Blue
const AM = isatty ? '\u001b[35m' : '' // ANSI Magenta
const AC = isatty ? '\u001b[36m' : '' // ANSI Cyan
const AW = isatty ? '\u001b[37m' : '' // ANSI White
const defaultWriteFlags = O_WRONLY | O_CREAT | O_TRUNC
const defaultWriteMode = S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const handle = new Uint32Array(2)
const stat = new Uint8Array(160)
const stat32 = new Uint32Array(stat.buffer)
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
// todo: should we just overwrite the existing ones and not put these on "lo"?
lo.getenv = wrap_getenv()
lo.getcwd = wrap_getcwd()
const LO_HOME = lo.getenv('LO_HOME') || lo.getcwd()
const LO_CACHE = parseInt(lo.getenv('LO_CACHE') || '0', 10)
core.homedir = LO_HOME
core.dlopen = wrap(handle, core.dlopen, 2)
core.dlsym = wrap(handle, core.dlsym, 2)
core.mmap = wrap(handle, core.mmap, 6)
core.isFile = is_file
core.read_file = read_file
core.write_file = write_file
core.little_endian = little_endian()

// todo: optimize this - return numbers and make a single call to get both
core.os = lo.os()
core.arch = lo.arch()
const MODE_WORD = core.arch === 'arm64' ? 4 : 6
const _builtins = lo.builtins()
lo.builtins = () => _builtins
const _libraries = lo.libraries()
lo.libraries = () => _libraries
//delete lo.library
//const noop = () => {}
//core.loader = core.sync_loader = noop
lo.setModuleCallbacks(on_module_load, on_module_instantiate)

// TODO: remove camel case names when we do a cleanup

core.readFile = read_file
core.writeFile = write_file
lo.evaluate_module = lo.evaluateModule
lo.get_address = lo.getAddress
lo.get_meta = lo.getMeta
lo.latin1_decode = lo.latin1Decode
lo.lib_cache = lo.libCache
lo.load_module = lo.loadModule
lo.module_cache = lo.moduleCache
lo.next_tick = lo.nextTick
lo.pump_message_loop = lo.pumpMessageLoop
lo.read_memory = lo.readMemory
lo.read_memory_at_offset = lo.readMemoryAtOffset
lo.register_callback = lo.registerCallback
lo.require_cache = lo.requireCache
lo.run_microtasks = lo.runMicroTasks
lo.run_script = lo.runScript
lo.set_flags = lo.setFlags
lo.set_module_callbacks = lo.setModuleCallbacks
lo.unwrap_memory = lo.unwrapMemory
lo.utf8_decode = lo.utf8Decode
lo.utf8_encode = lo.utf8Encode
lo.uft8_encode_into = lo.utf8EncodeInto
lo.utf8_encode_into_at_offset = lo.utf8EncodeIntoAtOffset
lo.utf8_length = lo.utf8Length
lo.wrap_memory = lo.wrapMemory



// todo: fix this and write up/decide exactly what module resolution does
// currently we check/open each file twice
/*
core.loader = specifier => {
  if (is_file(specifier)) return
  const home_path = `${LO_HOME}/${specifier}`
  if (is_file(home_path)) return decoder.decode(read_file(home_path))
}

core.binding_loader = name => {
  const handle = core.dlopen(`${LO_HOME}/lib/${name}/${name}.so`, 1)
  if (!handle) return
  const sym = core.dlsym(handle, `_register_${name}`)
  if (!sym) return
  const lib = library(sym)
  if (!lib) return
  lib.fileName = `lib/${name}/${name}.so`
  lib.handle = handle
  libCache.set(name, lib)
  return lib
}
*/

async function global_main () {
  // todo: upgrade, install etc. maybe install these as command scripts, but that would not be very secure
  const command = args[1]
  if (command === 'gen') {
    (await import('lib/gen.js')).gen(args.slice(2))
  } else if (command === 'build') {
    (await import('lib/build.js')).build(args.slice(2))
  } else if (command === 'repl') {
    (await import('lib/repl.js')).repl().catch(die)
  } else if (command === 'eval') {
    await (new AsyncFunction(args[2]))()
  } else {
    let filePath = command
    const { main, serve, test, bench } = await import(filePath)
    const pargs = args.slice(2)
    if (test) await test(...pargs)
    if (bench) await bench(...pargs)
    if (main) await main(...pargs)
    if (serve) await serve(...pargs)
  }
}

const AsyncFunction = async function () {}.constructor

if (workerSource) {
  import('worker_source.js').catch(die)
} else if (args.length > 1) {
  global_main().catch(die)
}

} // end bootstrap_runtime

bootstrap_runtime()

export {}
