import { run } from 'lib/bench.js'

const { pico } = spin.load('pico')
const { assert } = spin

const req = 'GET / HTTP/1.1\r\nHost: 127.0.0.1:3000\r\n\r\n'
//const req = 'GET / HTTP/1.1\r\nHost: www.reddit.com\r\nUser-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:15.0) Gecko/20100101 Firefox/15.0.1\r\nAccept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\nAccept-Language: en-us,en;q=0.5\r\nAccept-Encoding: gzip, deflate\r\nConnection: keep-alive\r\n\r\n'

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

//run('parseRequest', () => pico.parseRequest(buf, size, state), 60000000, 20)
run('parseRequest2', () => pico.parseRequest2(bptr, size, sptr), 30000000, 20)
// 2.48 GB/ 20Gbit per sec = 120 ns per iter
// https://github.com/rust-bakery/parser_benchmarks/blob/master/http/README.md