import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const { ptr } = spin

const { writestring1, writestring2, writestring3 } = (new Library())
  .open()
  .bind({
    writestring1: {
      parameters: ['pointer', 'string', 'i32'],
      result: 'pointer',
      name: 'memcpy'
    },
    writestring2: {
      parameters: ['buffer', 'string', 'i32'],
      result: 'pointer',
      name: 'memcpy'
    },
    writestring3: {
      parameters: ['pointer', 'pointer', 'i32'],
      result: 'void',
      name: 'memcpy'
    },
  })

class TextEncoder {
  encodeInto (str, u8) {
    writestring1(u8.ptr, str, str.length)
  }

  encodeInto2 (str, u8) {
    writestring2(u8, str, str.length)
  }

  encodeInto3 (sptr, dptr, len) {
    writestring3(dptr, sptr, len)
  }
}

const encoder = new TextEncoder()
//const data = (new Array(8).fill(0)).map(v => '1').join('')
const data = 'hello'
const out = ptr(new Uint8Array(data.length))
const sout = ptr(new Uint8Array(data.length))
encoder.encodeInto(data, sout)
const len = data.length
const sptr = sout.ptr
const dptr = out.ptr

const writeString = () => encoder.encodeInto(data, out)
const writeString2 = () => encoder.encodeInto2(data, out)
const writeString3 = () => encoder.encodeInto3(sptr, dptr, len)

run('writeString', writeString, 180000000, 10) // 10 ns per iter
//run('writeString2', writeString2, 180000000, 10) // 14 ns per iter
//run('writeString3', writeString3, 180000000, 10) // 5 ns per iter
