import { run } from 'lib/bench.js'
import { Library } from 'lib/ffi.js'

const req = 'GET /foo HTTP/1.1\r\nHost: tfb-server\r\nAccept: *.*\r\n\r\n'

const { phr_parse_request } = (new Library())
  .open('./module/pico/pico.so')
  .bind({
  phr_parse_request: {
    parameters: [
      'pointer', 'u32', 'u32array', 'u32array', 'u32array', 'u32array', 
      'u32array', 'buffer', 'u32array', 'u32'
    ],
    result: 'i32'
  }
})


const { assert } = spin

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
const encoder = new TextEncoder()
const rb = spin.ptr(encoder.encode(req))
function parse () {
  assert(parser.parse(rb.ptr, len) === len)
  assert(parser.method_len[0] === 3)
  assert(parser.path_len[0] === 4)
  assert(parser.minor_version[0] === 1)
  assert(parser.num_headers[0] === 2)
}

parse()

run('parser', parse, 20000000, 10)
