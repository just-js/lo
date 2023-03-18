globalThis.console = { log: str => spin.print(str), error: str => spin.error(str) }
globalThis.onUnhandledRejection = err => console.error(err.stack)

function wrap (h, fn, p = []) {
  const call = fn
  const params = p.map((_, i) => `p${i}`).join(', ')
  const f = new Function(
    'h',
    'call',
    `return function (${params}) {
    call(${params}${p.length > 0 ? ', ' : ''}h);
    return h[0] + ((2 ** 32) * h[1]);
  }`,)
  return f(h, call)
}

function ptr (u8) {
  u8.ptr = spin.getAddress(u8)
  u8.size = u8.byteLength
  return u8
}

function C (str) {
  return ptr(spin.utf8Encode(`${str}\0`))
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

function assert (condition, message, ErrorType = Error) {
  if (!condition) {
    throw new ErrorType(message || "Assertion failed")
  }
}

async function main () {
  if (spin.args[1] === 'eval') return (new Function(`return (${spin.args[2]})`)())()
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

async function onModuleLoad (specifier, resource) {
  if (moduleCache.has(specifier)) {
    const mod = moduleCache.get(specifier)
    if (!mod.evaluated) {
      mod.namespace = await spin.evaluateModule(mod.scriptId)
      mod.evaluated = true
    }
    return mod.namespace
  }
  const buf = ptr(readFileBytes(specifier))
  const src = spin.utf8Decode(buf.ptr, buf.byteLength)
  const mod = spin.loadModule(src, specifier)
  mod.resource = resource
  moduleCache.set(specifier, mod)
  const { requests, namespace } = mod
  for (const request of requests) {
    const buf = ptr(readFileBytes(request))
    const src = spin.utf8Decode(buf.ptr, buf.byteLength)
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
  throw new Error('oj')
}

const O_RDONLY = 0
const moduleCache = new Map()
const stat = ptr(new Uint8Array(160))
const st = new BigUint64Array(stat.buffer)

const { fs } = spin.load('fs')

spin.fs = fs
spin.fs.readFileBytes = readFileBytes
spin.hrtime = wrap(new Uint32Array(2), spin.hrtime, [])
spin.getAddress = wrap(new Uint32Array(2), spin.getAddress, ['buffer'])
spin.assert = assert
spin.moduleCache = moduleCache
spin.wrap = wrap
spin.cstr = C
spin.ptr = ptr
spin.addr = address
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
  await main(...spin.args.slice(1))
}
