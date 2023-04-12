import { run } from 'lib/bench.js'

const { pico } = spin.load('pico')
const { assert } = spin

const req = 'GET / HTTP/1.1\r\nHost: home.billywhizz.io\r\n\r\n'

const HTTP_CTX_SZ = 32
const HTTP_HEADER_SZ = 32
const MAXHEADERS = 14

const state = new Uint8Array(HTTP_CTX_SZ + (HTTP_HEADER_SZ * MAXHEADERS))
const encoder = new TextEncoder()
const buf = encoder.encode(req)
const size = buf.length

const bptr = spin.getAddress(buf)
const sptr = spin.getAddress(state)

assert(pico.parseRequest(buf, size, state) === size)
assert(pico.parseRequest2(bptr, size, sptr) === size)

//run('parseRequest', () => parseRequest(buf, size, state), 60000000, 20)
run('parseRequest2', () => pico.parseRequest2(bptr, size, sptr), 60000000, 20)
