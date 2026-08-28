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

function on_unhandled_rejection (err) {
  console.error(`${AR}Unhandled Rejection${AD}`)
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

function hrtime () {
  lo.hrtime(handle.ptr)
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
  lo.print('1\n')
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

async function on_module_load (specifier, resource) {
  const src = builtin(specifier)
  const mod = loadModule(src, specifier)
  if (!mod.evaluated) {
    mod.namespace = await evaluateModule(mod.identity)
    mod.evaluated = true
  }
  return mod.namespace
}

function on_module_instantiate (specifier) {
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

globalThis.onUnhandledRejection = on_unhandled_rejection
setModuleCallbacks(on_module_load, on_module_instantiate)

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
lo.colors = { AD, A0, AR, AG, AY, AB, AM, AC, AW }
core.os = lo.os()
core.arch = lo.arch()
const defaultReadFlags = O_RDONLY | (core.os === 'win' ? core._O_BINARY : 0)
const defaultWriteFlags = O_WRONLY | O_CREAT | O_TRUNC | (core.os === 'win' ? core._O_BINARY : 0)
const defaultWriteMode = core.os === 'win' ? core._S_IWRITE : (S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH)
const MAX_ENV = core.os === 'win' ? 32767 : 65536 // maximum environment variable size - todo
const MAX_DIR = 65536 // maximum path len - todo
core.defaultWriteFlags = defaultWriteFlags
core.defaultWriteMode = defaultWriteMode
const stat = new Uint8Array(160)
const stat32 = new Uint32Array(stat.buffer)
const stat16 = new Uint16Array(stat.buffer)
const st = new BigUint64Array(stat.buffer)

const { dump } = await import('lib/binary.js')
const { join } = await import('lib/path.js')
const { stringify } = await import('lib/stringify.js')
const proc = await import('lib/proc.js')
const { control } = await import('lib/ansi.js')
const bb = read_file('./main.cc')
lo.core = core
const AsyncFunction = async function () {}.constructor

globalThis.snapshotEntry = async function () {
//  const isatty = core.isatty(STDOUT)
//  lo.print(`isatty: ${isatty}\n`)
//  lo.print(`${dump(bb)}\n`)
//  const cc = read_file('./main.h')
//  lo.print(`${dump(cc)}\n`)
  handle.ptr = get_address(handle)
//  await next_tick()
  lo.print(`${hrtime() - lo.start}\n`)
//  lo.print(`${stringify(lo)}\n`)
  await (new AsyncFunction(lo.args[1]))()
}
