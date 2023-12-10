import { exec, exec_env } from 'lib/proc.js'
import { isFile } from 'lib/fs.js'

const { assert, core, colors, getenv } = lo
const { AD, AY } = colors
const { os, unlink } = core

let C = getenv('C') || 'clang'
let CC = getenv('CC') || 'clang++'
let LINK = getenv('LINK') || 'clang++'
if (os === 'linux') {
  C = getenv('C') || 'gcc'
  CC = getenv('CC') || 'g++'
  LINK = getenv('LINK') || 'g++'
}

const bindings = (os === 'linux' ? [
  'core', 
  'curl',
//  'duckdb',
  'encode', 
  'epoll', 
  'inflate',
  'libffi',
//  'libssl',
  'lz4', 
  'net', 
  'pico', 
  'pthread', 
  'sqlite', 
  'system', 
  'zlib'
] : [
  'core', 
  'curl',
  'encode', 
  'inflate', 
  'libffi', 
//  'libssl', 
  'machkq',
  'net', 
  'pico', 
  'pthread', 
  'sqlite', 
  'system', 
  'zlib'      
])

function build_runtime (name, target = name) {
  assert(exec_env('./lo', 
    [ 'build', 'runtime', name ], 
    [ ['TARGET', target], ['C', C], ['CC', CC], ['LINK', LINK] ]
  )[0] === 0)
  assert(exec(`./${target}`, ['test/dump.js'])[0] === 0)
}

function build_binding (name) {
  assert(exec_env('./lo', 
    [ 'build', 'binding', name ], 
    [ ['C', C], ['CC', CC], ['LINK', LINK] ]
  )[0] === 0)
  assert(exec('./lo', ['test/dump-binding.js', name])[0] === 0)
}
console.log(`${AY}building runtimes${AD}`)
build_runtime('builder', 'lo')
build_runtime('mbedtls', 'mbed')
build_runtime('core', 'core')
build_runtime('full', 'full')

console.log(`${AY}deleting runtimes${AD}`)
assert(isFile('mbed')) && unlink('mbed')
assert(isFile('core')) && unlink('core')
assert(isFile('full')) && unlink('full')

console.log(`${AY}building bindings${AD}`)
for (const name of bindings) build_binding(name)

console.log(`💩💩💩 All Done! 💩💩💩`)
