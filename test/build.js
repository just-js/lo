import { exec, exec_env } from 'lib/proc.js'
import { isFile } from 'lib/fs.js'

const { assert, core, colors, getenv, load } = lo
const { AD, AY, AC } = colors
const { os, unlink } = core

const CC = getenv('CC') || 'clang'
const CXX = getenv('CXX') || 'clang++'
const LINK = getenv('LINK') || 'clang++'

const bindings = [
  'bestlines',
  'boringssl',
  'cfzlib',
  'core',
  'curl',
  'encode',
  'heap',
  'inflate',
//  'libffi',
  'libssl',
  'mbedtls',
  'net',
  'pico',
  'pthread',
  'sqlite',
  'system',
  'zlib'
]
if (os === 'linux') {
  bindings.push('epoll')
  bindings.push('fsmount')
  bindings.push('seccomp')
  bindings.push('wireguard')
  bindings.push('tcc')
} else if (os === 'mac') {
  bindings.push('kevents')
  bindings.push('mach')
}

function build_runtime (target, config_path) {
  assert(exec_env('./lo', 
    [ 'build', 'runtime', config_path, '-v' ], 
    [ ['LO_TARGET', target], ['CC', CC], ['CXX', CXX], ['LINK', LINK] ]
  )[0] === 0)
  assert(exec(`./${target}`, ['test/dump.js'])[0] === 0)
}

function build_binding (name) {
  assert(exec_env('./lo', 
    [ 'build', 'binding', name, '-v' ], 
    [ ['CC', CC], ['CXX', CXX], ['LINK', LINK] ]
  )[0] === 0)
  assert(exec('./lo', ['test/dump-binding.js', name])[0] === 0)
}

console.log(`${AY}building bindings${AD}`)
for (const name of bindings) {
  build_binding(name)
  const lib = assert(load(name))
  const binding = lib[name]
  const entries = Object.entries(binding)
  entries.sort((a, b) => a < b ? -1 : (a === b ? 0 : 1))
  for (const [key, value] of entries) {
    if (['AsyncFunction', 'Function'].includes(value.constructor.name)) {
      console.log(`    ${AC}${key}${AD}: ${value.constructor.name} (${value.length})`)
    } else if (['Object'].includes(value.constructor.name)) {
      console.log(`    ${AC}${key}${AD}: ${value.constructor.name}`)
    } else {
      console.log(`    ${AY}${key}${AD}: ${value.constructor.name} = ${value}`)
    }
  }
}

console.log(`${AY}building runtimes${AD}`)
build_runtime('build_test_lo', 'runtime/lo')
build_runtime('build_test_base', 'runtime/base')
console.log(`${AY}deleting runtimes${AD}`)
assert(isFile('build_test_lo')) && assert(unlink('build_test_lo') === 0)
assert(isFile('build_test_base')) && assert(unlink('build_test_base') === 0)

console.log(`💩💩💩 All Done! 💩💩💩`)
