import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const api = {
  memcpy: {
    parameters: ['buffer', 'string', 'i32'],
    result: 'pointer'
  }
}

const std = (new Library()).open().bind(api)
const str = (new Array(8).fill(0)).map(() => '0').join('')
const len = str.length
const out = new Uint8Array(len)

const writeString = () => std.memcpy(out, str, len)

run('writeString', writeString, 180000000, 10)
