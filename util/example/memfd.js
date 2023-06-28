import { Library } from 'lib/ffi.js'

/*
demonstration of loading a shared library from memory
*/

const { fs, dlopen, assert, dlsym } = spin
const { AD, AC, AY } = spin.colors

const libc = (new Library()).open().bind({
  memfd_create: {
    parameters: ['string', 'u32'],
    result: 'i32'
  },
})

function loadLibrary (addr, name) {
  const sym = dlsym(addr, `_register_${name}`)
  assert(sym)
  const lib = spin.library(sym)
  assert(lib)
  assert(lib[name])
  const props = Object.getOwnPropertyNames(lib[name]).map(n => `${AC}${n}${AD}`)
  console.log(`${AY}${name}${AD}: ${props}`)
  return lib
}

const libName = '../runtime/runtime.so'
const fd = libc.memfd_create('foobar', 0)
assert(fd > 2)
const bytes = fs.readFile(libName)
assert(bytes.length)
assert(fs.write(fd, bytes, bytes.length) === bytes.length)
const addr = dlopen(`/proc/self/fd/${fd}`, 1)
assert(addr)

const libs = [
  'encode', 
  'epoll', 
  'fs', 
  'load',
  'libssl', 
  'net', 
  'pico', 
  'rocksdb', 
  'rsync', 
  'rustls',
  'seccomp',
  'spin',
  'sqlite', 
  'system',
  'tcc',
  'thread', 
  'wireguard'
].map(name => loadLibrary(addr, name))

//const src = new Uint8Array((new Array(256)).fill(0).map(v => Math.ceil(Math.random() * 255)))
//const dest = new Uint8Array(src.length * 2)
//console.log(dest)
//libs[0].encode.hex_encode(src, src.length, dest, dest.length)
//console.log(dest)
//console.log(spin.utf8Decode(spin.getAddress(dest), dest.length))
