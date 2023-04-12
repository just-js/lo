import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const libc = (new Library()).open().bind({
  getcwd: {
    parameters: ['buffer', 'i32'],
    pointers: ['char*'],
    result: 'void'
  }
})

const u8 = new Uint8Array(1024)
const size = u8.length
const ptr = spin.getAddress(u8)
const { utf8Decode } = spin
const { getcwd } = libc

function cwd () {
  getcwd(u8, size)
  return utf8Decode(ptr, size)
}

console.log(cwd())

run('cwd', cwd, 2000000, 20)
