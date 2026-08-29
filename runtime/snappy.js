function on_unhandled_rejection (err) {
  console.error(`${AR}Unhandled Rejection${AD}`)
  handle_error(err)
  die(err, true)
}

function ptr (u8) {
  if (u8.ptr) return u8
  u8.ptr = get_address(u8)
  return u8
}

function fix_stack (err) {
  err.stack = err.stack.split('\n')
    .filter(line => !line.match(/\s+at assert \(main\.js.+/))
    .join('\n')
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

function wrap (handle, fn, plen = 0) {
  ptr(handle)
  const call = fn
  const params = (new Array(plen)).fill(0).map((_, i) => `p${i}`).join(', ')
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

function addr (u32) {
  return u32[0] + ((2 ** 32) * u32[1])
}

function get_address (buf) {
  lo.getAddress(buf, handle)
  return addr(handle)
}

function check_mode (val, mode) {
  return (val & S_IFMT) === mode
}

function next_tick (fn) {
  return new Promise(ok => lo.nextTick(ok))
}

function read_file (path, flags = defaultReadFlags, size = 0) {
  const fd = open(path, flags)
  assert(fd > 0, `failed to open ${path} with flags ${flags}`)
  stat.ptr = get_address(stat)
  if (size === 0) {
    assert(fstat(fd, stat.ptr) === 0)
    if (core.os === 'mac') {
      size = Number(st[12])
    } else if (core.os === 'win') {
      size = stat32[5]
    } else {
      size = Number(st[6])
    }
  }
  let off = 0
  let len = 0
  const u8 = ptr(new Uint8Array(size))
  while ((len = read(fd, u8.ptr, size - off)) > 0) off += len
  close(fd)
  return u8
}

async function load_source (specifier, resource) {
  let src = ''
  if (core.loader) {
    src = await core.loader(specifier, resource)
    if (src) return src
  }
  src = lo.builtin(specifier)
  if (src) return src
  if (LO_CACHE === 1) {
    try {
      src = decoder.decode(read_file(specifier))
    } catch (err) {
      src = decoder.decode(read_file(`${LO_HOME}/${specifier}`))
    }
  }
  return src
}

function wrap_getenv () {
  const { getenv, strnlen } = core
//  const getenv = wrap(handle, core.getenv, 1)
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

async function on_module_load (specifier, resource) {
  console.log(`on_module_load ${specifier} ${resource}`)
  if (!specifier) return
  if (moduleCache.has(specifier)) {
    const mod = moduleCache.get(specifier)
    if (!mod.evaluated) {
      mod.namespace = await evaluateModule(mod.identity)
      mod.evaluated = true
    }
    return mod.namespace
  }
  let src = ''
  if (specifier === 'worker_source.js') {
    builtin_cache.set(specifier, workerSource)
    src = workerSource
  } else {
    src = await load_source(specifier, resource)
  }
  const mod = loadModule(src, specifier)
  mod.resource = resource
  moduleCache.set(specifier, mod)
  const { requests } = mod
  for (const request of requests) {
    const src = await load_source(request, resource)
    const mod = loadModule(src, request)
    moduleCache.set(request, mod)
  }
  if (!mod.evaluated) {
    mod.namespace = await evaluateModule(mod.identity)
    mod.evaluated = true
  }
  return mod.namespace
/*
  const src = builtin(specifier)
  const mod = loadModule(src, specifier)
  if (!mod.evaluated) {
    mod.namespace = await evaluateModule(mod.identity)
    mod.evaluated = true
  }
  return mod.namespace
*/
}

function on_module_instantiate (specifier) {
  console.log(`on_module_instantiate ${specifier}`)
  const src = builtin(specifier)
  const mod = loadModule(src, specifier)
  return mod.identity
}

function die (err, hide_fatal = false) {
  if (!hide_fatal) console.error(`${AR}Fatal Exception${AD}`)
  handle_error(err)
  console.error(`${AY}process will exit${AD}`)
  exit(1)
}

function little_endian () {
  const buffer = new ArrayBuffer(2)
  new DataView(buffer).setInt16(0, 256, true)
  return new Int16Array(buffer)[0] === 256
}

function on_load_builtin (identifier) {
  if (builtin_cache.has(identifier)) return builtin_cache.get(identifier)
  // todo: use the actual index.js specified for the compiled runtime if we are in a compiled runtime
  if (identifier === 'worker_source.js') {
    builtin_cache.set(identifier, workerSource)
    return workerSource
  }
  builtin_cache.set(identifier, builtin(identifier))
  return builtin(identifier)
}

function get_lines_for_error (file_name, line_num, col_num) {
//  console.log(`get_lines_for_error ${file_name}`)
  if (lo.builtins().includes(file_name)) {
    return builtin(file_name)
      .split('\n')
      .slice(line_num - 5, line_num + 5)
      .map((l, i) => `${AY}${(i + line_num - 4).toString().padStart(4, ' ')}${AD}: ${i === 4 ? AM : ''}${l}${AD}`)
      .join('\n')
  }
  if (lo.module_cache.has(file_name)) {
    return lo.module_cache.get(file_name).src
      .split('\n')
      .slice(line_num - 5, line_num + 5)
      .map((l, i) => `${AY}${(i + line_num - 4).toString().padStart(4, ' ')}${AD}: ${i === 4 ? AM : ''}${l}${AD}`)
      .join('\n')
  }
  // we might have failed importing the module, which means it won't be in the cache, so try to read it from the path
  try {
    const src = decoder.decode(read_file(file_name))
    return src
      .split('\n')
      .slice(line_num - 5, line_num + 5)
      .map((l, i) => `${AY}${(i + line_num - 4).toString().padStart(4, ' ')}${AD}: ${i === 4 ? AM : ''}${l}${AD}`)
      .join('\n')

  } catch (err) {
    // eat the exception
//    console.log(`error loading ${file_name}`)
//    console.log(err.stack)
  }
  return ''
}

const rx_err = /\(?([\w\/\.\-_]+):(\d+):(\d+)\)?/

function handle_error (err) {
  const { stack } = err
  try {
    const stack_lines = stack.split('\n')
    if (stack_lines.length > 1) {
      const match = rx_err.exec(stack_lines[1])
      if (match && match.length > 3) {
        const file_name = match[1].trim()
        const line_num = parseInt(match[2], 10)
        const col_num = parseInt(match[3], 10)
        const lines = get_lines_for_error(file_name, line_num, col_num)
        console.error(`${AR}Error${AD} ${err.message}${AD}\n${stack.split('\n').slice(1).join('\n')}`)
        console.error(lines)
        return
      }
    }
  } catch (err) {}
  console.error(`${AR}Error${AD} ${err.message}${AD}\n${stack.split('\n').slice(1).join('\n')}`)
}

class TextEncoder {
  encoding = 'utf-8'

  encode (input = '') {
    // todo: empty string
    // todo: result cache
    return utf8Encode(input)
  }

  /**
  * @param {string} src
  * @param {TypedArray} dest
  */
  encodeInto (src, dest) {
    // todo: pass a u32array(2) handle in here so we can return read, written
    if (!dest.ptr) ptr(dest)
    return { written: utf8EncodeInto(src, dest.ptr) }
  }
}

class TextDecoder {
  encoding = 'utf-8'

  /**
  * @param {TypedArray} u8
  */
  decode (u8) {
    // todo: result cache
    if (!u8.ptr) ptr(u8)
    return utf8Decode(u8.ptr, u8.length)
  }
}

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
  if (core.os === 'win') {
    // TODO
    return
  } else {
    const handle = core.dlopen(`lib/${name}/${name}.so`, RTLD_LAZY) ||
      core.dlopen(`${LO_HOME}/lib/${name}/${name}.so`, RTLD_LAZY)
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

const { core } = lo.library('core')

const { 
  utf8EncodeInto, utf8Encode, utf8Decode, getAddress, args, exit, builtin,
  library, workerSource, loadModule, evaluateModule, wrapMemory,
  setModuleCallbacks
} = lo

const {
  O_WRONLY, O_CREAT, O_TRUNC, O_RDONLY, S_IWUSR, S_IRUSR, S_IRGRP, S_IROTH,
  S_IFREG, STDOUT, STDERR, S_IFMT, RTLD_LAZY
} = core

const {
  write_string, open, fstat, read, write, close, strnlen
} = core

lo.core = core
lo.load = load

globalThis.onUnhandledRejection = on_unhandled_rejection
setModuleCallbacks(on_module_load, on_module_instantiate)

lo.getenv = wrap_getenv()

const AsyncFunction = async function () {}.constructor
const builtin_cache = new Map()
const handle = new Uint32Array(2)
const isatty = core.isatty(STDOUT)
const AD = isatty ? '\u001b[0m' : '' // ANSI Default
const A0 = isatty ? '\u001b[90m' : '' // ANSI Black
const AR = isatty ? '\u001b[91m' : '' // ANSI Red
const AG = isatty ? '\u001b[92m' : '' // ANSI Green
const AY = isatty ? '\u001b[93m' : '' // ANSI Yellow
const AB = isatty ? '\u001b[94m' : '' // ANSI Blue
const AM = isatty ? '\u001b[95m' : '' // ANSI Magenta
const AC = isatty ? '\u001b[96m' : '' // ANSI Cyan
const AW = isatty ? '\u001b[97m' : '' // ANSI White
const colors = { AD, A0, AR, AG, AY, AB, AM, AC, AW }
lo.colors = colors
core.os = lo.os()
core.arch = lo.arch()
const defaultReadFlags = O_RDONLY | (core.os === 'win' ? core._O_BINARY : 0)
const defaultWriteFlags = O_WRONLY | O_CREAT | O_TRUNC | (core.os === 'win' ? core._O_BINARY : 0)
const defaultWriteMode = core.os === 'win' ? core._S_IWRITE : (S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH)
const MAX_ENV = core.os === 'win' ? 32767 : 65536 // maximum environment variable size - todo
const MAX_DIR = 65536 // maximum path len - todo
core.defaultWriteFlags = defaultWriteFlags
core.defaultWriteMode = defaultWriteMode
const moduleCache = new Map()
const requireCache = new Map()
const libCache = new Map()
const stat = new Uint8Array(160)
const stat32 = new Uint32Array(stat.buffer)
const stat16 = new Uint16Array(stat.buffer)
const st = new BigUint64Array(stat.buffer)
globalThis.console = {
  log: v => lo.print(`${v}\n`),
  error: v => lo.print(`${v}\n`),
}
globalThis.TextEncoder = TextEncoder
globalThis.TextDecoder = TextDecoder
const encoder = new TextEncoder()
const decoder = new TextDecoder()
//const LO_HOME = lo.getenv('LO_HOME')
//const LO_CACHE = parseInt(lo.getenv('LO_CACHE') || '0', 10)
//const { hrtime } = lo
//lo.hrtime = function() {
//  hrtime(handle.ptr)
//  return addr(handle)
//}
//const { dump } = await import('lib/binary.js')
//const { stringify } = await import('lib/stringify.js')
//const bb = read_file('./main.cc')
//const { join } = await import('lib/path.js')
//const { control } = await import('lib/ansi.js')
//const proc = await import('lib/proc.js')
//  const { Bench } = await import('lib/bench.js')
//console.log(lo.getenv('HOME'))

globalThis.snapshotEntry = async function () {
  lo.core = core
  lo.colors = colors
  lo.assert = assert
  lo.ptr = ptr
  lo.load = load
  const { hrtime } = lo
  handle.ptr = get_address(handle)
  lo.hrtime = function() {
    hrtime(handle.ptr)
    return addr(handle)
  }
  console.log(`${lo.hrtime() - lo.start}`)
/*
  console.log(dump(bb))
  const binary = await import('lib/binary.js')
  console.log(stringify(binary))
  console.log(lo.builtins())
  console.log(lo.builtin('lib/binary.js'))
  const { Bench } = await import('lib/bench.js')
  await next_tick()
  console.log(`${lo.hrtime() - lo.start}`)
  console.log(stringify(lo))
  console.log(lo.utf8Length("hello"))
  await (new AsyncFunction(lo.args[1]))()
  console.log(lo.core.getpid())
  const bench = new Bench()
  const pid = lo.core.getpid()
  const runs = 10000000
  console.log(lo.hrtime())
  for (let i = 0; i < 10; i++) {
    bench.start('getpid')
    for (let j = 0; j < runs; j++) {
      assert(lo.core.getpid() === pid)
    }
    bench.end(runs)
  }
  throw new Error('Fuck')
*/
}
