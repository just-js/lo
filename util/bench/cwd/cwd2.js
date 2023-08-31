import { run } from 'lib/bench.js'
import { bind } from 'lib/fast.js'

const getcwd = bind(spin.dlsym(0, 'getcwd'), 'void', ['pointer', 'i32'])

const u8 = new Uint8Array(1024)
const size = u8.length
const ptr = spin.getAddress(u8)
const { utf8Decode } = spin

function cwd () {
  getcwd(ptr, size)
  return utf8Decode(ptr, size)
}

console.log(cwd())

run('cwd', cwd, 2000000, 20)
