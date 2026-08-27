const { core } = lo.library('core')

const {
  O_WRONLY, O_CREAT, O_TRUNC, O_RDONLY, S_IWUSR, S_IRUSR, S_IRGRP, S_IROTH,
  S_IFREG, STDOUT, STDERR, S_IFMT, RTLD_LAZY
} = core

const {
  write_string, open, fstat, read, write, close, strnlen
} = core

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

globalThis.onUnhandledRejection = err => {
  lo.print(`Error 1:\n${err.message}\n${err.stack}\n`)
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

const handle = new Uint32Array(2)

function next_tick (fn) {
  return new Promise(ok => lo.nextTick(ok))
}

//next_tick().then(() => {
//  lo.print('snapshotting\n')
//})

async function on_module_load (specifier, resource) {
//  lo.print(`on_module_load ${specifier} ${resource}\n`)
  const src = lo.builtin(specifier)
//  lo.print(src)
  const mod = lo.loadModule(src, specifier)
  if (!mod.evaluated) {
    mod.namespace = await lo.evaluateModule(mod.identity)
    mod.evaluated = true
  }
  return mod.namespace
}

function on_module_instantiate (specifier) {
//  lo.print(`on_module_instantiate ${specifier}\n`)
  const src = lo.builtin(specifier)
  const mod = lo.loadModule(src, specifier)
  return mod.identity
}

lo.setModuleCallbacks(on_module_load, on_module_instantiate)

const { dump } = await import('lib/binary.js')

//lo.print(`${dump(new Uint8Array(256))}\n`)

globalThis.snapshotEntry = async function () {
  const isatty = core.isatty(STDOUT)
  lo.print(`isatty: ${isatty}\n`)
  lo.print(`${dump(new Uint8Array(256))}\n`)
  handle.ptr = get_address(handle)
  await next_tick()
  lo.print(`${hrtime() - lo.start}\n`)
}
