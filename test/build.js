import { exec, exec_env } from 'lib/proc.js'
import { isFile } from 'lib/fs.js'

const { assert, core, colors, getenv } = lo
const { AD, AY } = colors
const { os, unlink } = core

let CC = getenv('CC') || 'clang'
let CXX = getenv('CXX') || 'clang++'
let LINK = getenv('LINK') || 'clang++'
if (os === 'linux') {
  CC = getenv('CC') || 'gcc'
  CXX = getenv('CXX') || 'g++'
  LINK = getenv('LINK') || 'g++'
}

const bindings = [
  'bestlines',
  'boringssl',
  'cfzlib',
  'core',
  'curl',
  'encode',
  'heap',
  'inflate',
  'libffi',
  'libssl',
  'mbedtls',
  'net',
  'pico',
  'pthread',
  'sqlite',
  'system',
  'tcc',
  'zlib'
]
if (os === 'linux') {
  bindings.push('epoll')
  bindings.push('fsmount')
  bindings.push('seccomp')
  bindings.push('wireguard')
} else if (os === 'mac') {
  bindings.push('kevents')
  bindings.push('mach')
}

function build_runtime (target, config_path) {
  assert(exec_env('./lo', 
    [ 'build', 'runtime', config_path ], 
    [ ['TARGET', target], ['CC', CC], ['CXX', CXX], ['LINK', LINK] ]
  )[0] === 0)
  assert(exec(`./${target}`, ['test/dump.js'])[0] === 0)
}

function build_binding (name) {
  assert(exec_env('./lo', 
    [ 'build', 'binding', name ], 
    [ ['CC', CC], ['CXX', CXX], ['LINK', LINK] ]
  )[0] === 0)
  assert(exec('./lo', ['test/dump-binding.js', name])[0] === 0)
}

console.log(`${AY}building runtimes${AD}`)
build_runtime('build_test', 'runtimes/lo.config.js')
console.log(`${AY}deleting runtimes${AD}`)
assert(isFile('build_test')) && assert(unlink('build_test') === 0)

console.log(`${AY}building bindings${AD}`)
for (const name of bindings) build_binding(name)

console.log(`💩💩💩 All Done! 💩💩💩`)
