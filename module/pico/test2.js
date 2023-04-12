import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const { assert } = spin

const req = 'GET / HTTP/1.1\r\nHost: foo.bar.baz1\r\n\r\n'

const { parseRequest, parseResponse } = (new Library())
  .open('./module/pico/pico.so')
  .bind({
    parseRequest: {
      parameters: ['buffer', 'u32', 'buffer'],
      pointers: ['char*', ,'httpRequest*'],
      result: 'i32',
      name: 'parse_request'
    },
    parseResponse: {
      parameters: ['buffer', 'u32', 'buffer'],
      pointers: ['char*', ,'httpResponse*'],
      result: 'i32',
      name: 'parse_response'
    }
  })

const HTTP_CTX_SZ = 32
const HTTP_HEADER_SZ = 32
const MAXHEADERS = 14

const state = new Uint8Array(HTTP_CTX_SZ + (HTTP_HEADER_SZ * MAXHEADERS))
const encoder = new TextEncoder()
const buf = encoder.encode(req)
const size = buf.length

assert(parseRequest(buf, size, state) === size)

run('parser', () => parseRequest(buf, size, state), 60000000, 20)
