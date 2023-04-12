import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const req = 'GET /foo HTTP/1.1\r\nHost: tfb-server\r\nAccept: *.*\r\n\r\n'

const { phr_parse_request } = (new Library())
  .open('./module/pico/picohttpparser.so')
  .bind({
  phr_parse_request: {
    parameters: [
      'string', 'u32', 'u32array', 'u32array', 'u32array', 'u32array', 
      'u32array', 'buffer', 'u32array', 'u32'
    ],
    result: 'i32'
  }
})


const { assert, addr, utf8Decode } = spin
/*
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
*/

class Parser {
  method = new Uint32Array(2)
  method_len = new Uint32Array(2)
  path = new Uint32Array(2)
  path_len = new Uint32Array(2)
  minor_version = new Uint32Array(2)
  headers = new Uint8Array(32 * 16)
  num_headers = new Uint32Array(2)

  constructor () {
    this.num_headers[0] = 16
  }

  parse (req, len) {
    const { method, method_len, path, path_len, minor_version, headers, num_headers } = this
    return phr_parse_request(req, len, method, method_len, path, path_len, 
      minor_version, headers, num_headers, 0)
  }
}

const len = req.length
const parser = new Parser()
assert(parser.parse(req, len) === len)

run('parser', () => parser.parse(req, len), 20000000, 10)
