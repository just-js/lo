import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const req = 'GET /foo HTTP/1.1\r\nHost: tfb-server\r\nAccept: *.*\r\n\r\n'

const { phr_parse_request } = (new Library()).open('./module/pico/picohttpparser.so').bind({
  phr_parse_request: {
    parameters: [
      'string', 'u32', 'u32array', 'u32array', 'u32array', 'u32array', 
      'u32array', 'buffer', 'u32array', 'u32'
    ],
    result: 'i32'
  }
})

const { assert, addr, utf8Decode } = spin

const method = new Uint32Array(2)
const method_len = new Uint32Array(2)
const path = new Uint32Array(2)
const path_len = new Uint32Array(2)
const minor_version = new Uint32Array(2)
const headers = new Uint8Array(32 * 16)
const num_headers = new Uint32Array(2)
num_headers[0] = 16
const bytes = phr_parse_request(req, req.length, method, method_len, path, 
  path_len, minor_version, headers, num_headers, 0)
assert(bytes === req.length)
console.log(`method ${utf8Decode(addr(method), method_len[0])}`)
console.log(`path ${utf8Decode(addr(path), path_len[0])}`)
console.log(`version ${minor_version[0]}`)
console.log(`num_headers ${num_headers[0]}`)
let off = 0
for (let i = 0; i < num_headers[0]; i++) {
  console.log(headers.slice(off, off + 32))
  off += 32
}

run('phr_parse_request', () => {
  num_headers[0] = 16
  const bytes = phr_parse_request(req, req.length, method, method_len, path, path_len, 
    minor_version, headers, num_headers, 0)
  assert(bytes === req.length)
  return bytes
}, 1000000, 10)
