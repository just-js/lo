import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const { ptr } = spin

const { memcpy, memcpy2 } = (new Library())
  .open()
  .bind({
    memcpy: {
      parameters: ['pointer', 'string', 'i32'],
      result: 'pointer',
      name: 'memcpy'
    },
    memcpy2: {
      parameters: ['buffer', 'string', 'i32'],
      result: 'pointer',
      name: 'memcpy'
    }
  })

class TextEncoder {
  encodeInto (str, u8) {
    memcpy(u8.ptr, str, str.length)
  }

  encodeInto2 (str, u8) {
    memcpy2(u8, str, str.length)
  }
}

const encoder = new TextEncoder()
const data = (new Array(8).fill(0)).map(v => '1').join('')
const out = ptr(new Uint8Array(data.length))

const writeString = () => encoder.encodeInto(data, out)
const writeString2 = () => encoder.encodeInto2(data, out)

//run('writeString', writeString, 180000000, 10)
//run('writeString2', writeString2, 180000000, 10)
