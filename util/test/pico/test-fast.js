import { run } from 'lib/bench.js'
import { bind } from 'lib/fast.js'

const { dlopen, dlsym, assert } = spin

const handle = dlopen('./module/pico/pico.so', 1)
const phr_parse_request = bind(dlsym(handle, 'phr_parse_request'), 'i32', [
  'pointer', 'u64', 'pointer', 'pointer', 'pointer', 'pointer', 
  'pointer', 'pointer', 'pointer', 'u64'
])

class Parser {
  method = spin.ptr(new Uint32Array(2))
  method_len = spin.ptr(new Uint32Array(2))
  path = spin.ptr(new Uint32Array(2))
  path_len = spin.ptr(new Uint32Array(2))
  minor_version = spin.ptr(new Uint32Array(1))
  headers = spin.ptr(new Uint8Array(32 * 16))
  num_headers = spin.ptr(new Uint32Array(2))

  constructor () {
    this.num_headers[0] = 16
    this.parse = (new Function('parse', `
    return function (ptr, len) {
      return parse(ptr, len, ${this.method.ptr}, 
        ${this.method_len.ptr}, ${this.path.ptr}, ${this.path_len.ptr}, 
        ${this.minor_version.ptr}, ${this.headers.ptr}, ${this.num_headers.ptr}, 0)
    }
    `))(phr_parse_request)
  }
}

const req = 'GET /foo HTTP/1.1\r\nHost: tfb-server\r\nAccept: *.*\r\n\r\n'
const len = req.length
const encoder = new TextEncoder()
const rb = spin.ptr(encoder.encode(req))
const parser = new Parser()
const rbptr = rb.ptr

function parse () {
  assert(parser.parse(rbptr, len) === len)
  assert(parser.method_len[0] === 3)
  assert(parser.path_len[0] === 4)
  assert(parser.minor_version[0] === 1)
  assert(parser.num_headers[0] === 2)
}

parse()

//run('parser', parse, 60000000, 10)
run('parser.parse', () => parser.parse(rbptr, len), 60000000, 10)
