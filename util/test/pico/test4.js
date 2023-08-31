import { run } from 'lib/bench.js'
import { bind } from 'lib/fast.js'

const { assert, dlopen, dlsym } = spin

const req = 'GET / HTTP/1.1\r\nHost: foo.bar.baz1\r\n\r\n'

const HTTP_CTX_SZ = 32
const HTTP_HEADER_SZ = 32
const MAXHEADERS = 14

const state = new Uint8Array(HTTP_CTX_SZ + (HTTP_HEADER_SZ * MAXHEADERS))
const encoder = new TextEncoder()
const buf = encoder.encode(req)
const size = buf.length

const bptr = spin.getAddress(buf)
const sptr = spin.getAddress(state)

const handle = dlopen('./module/pico/pico.so', 1)
assert(handle)
const parse = bind(dlsym(handle, 'parse_request'), 'i32', ['pointer', 'u32', 'pointer'])

assert(parse(bptr, size, sptr) === size)

run('parse', () => parse(bptr, size, sptr), 60000000, 20)
