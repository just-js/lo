import { net } from 'lib/net.js'
import { system } from 'lib/system.js'
import { libssl } from 'lib/libssl.js'
import { pico } from 'lib/pico.js'

const { assert, ptr, utf8Decode } = spin
const { socket, connect, close } = net
const { SOCK_STREAM, AF_INET, SOCKADDR_LEN } = net.constants
const { sockaddr_in } = net.types
const {
  SSL_set_fd, SSL_connect, SSL_write, SSL_read, TLS_client_method, SSL_CTX_new,
  SSL_new, SSL_free, SSL_CTX_free
} = libssl

const hostname = 'codeload.github.com'
const port = 443
const ip_address = '140.82.121.9'
const ssl_method = TLS_client_method()
const ssl_context = SSL_CTX_new(ssl_method)
const ssl = SSL_new(ssl_context)
const fd = socket(AF_INET, SOCK_STREAM, 0)
assert(fd > 2)
assert(SSL_set_fd(ssl, fd) === 1)
assert(connect(fd, sockaddr_in(ip_address, port), SOCKADDR_LEN) === 0)
assert(SSL_connect(ssl) === 1)
const encoder = new TextEncoder()
const [ org = 'just-js', project = 'just', tag = '0.1.13' ] = spin.args.slice(2)
const request_str = `GET /${org}/${project}/tar.gz/refs/tags/${tag} HTTP/1.1\r
Host: ${hostname}\r
Accept: */*\r
Connection: close\r\n\r\n`
const payload = ptr(encoder.encode(request_str))
assert(SSL_write(ssl, payload.ptr, payload.length) === payload.length)

const HTTP_CTX_SZ = 32
const HTTP_HEADER_SZ = 1024
const MAXHEADERS = 64
const sbuf = new Uint8Array(HTTP_CTX_SZ + (HTTP_HEADER_SZ * MAXHEADERS))
const state = new Uint32Array(sbuf.buffer)
let headers_done = false
let off = 0
const recv_buf = ptr(new Uint8Array(65536))

const start = recv_buf.ptr
const len = recv_buf.length

const request = {
  version: 0,
  status: 0,
  headers: {},
  size: 0,
  body: [],
  bodySize: 0
}

let bytes = SSL_read(ssl, start, len)
while (bytes > 0) {
  if (headers_done) {
    request.body.push(recv_buf.slice(0, bytes))
    bytes = SSL_read(ssl, start + off, len - off)
    continue
  }
  const parsed = pico.parseResponse(recv_buf.subarray(0, off + bytes), off + bytes, state)
  if (parsed > 0) {
    const [version, status, nheader] = state
    if (version !== 1) throw new Error(`Bad HTTP Version ${version}`)
    if (status !== 200) throw new Error(`Bad HTTP Status ${status}`)
    request.version = version
    request.status = status
    let hoff = 8
    for (let i = 0; i < nheader; i++) {
      const [nstart, nlen, vstart, vlen] = state.subarray(hoff, hoff + 4)
      const name = utf8Decode(start + nstart, nlen)
      const value = utf8Decode(start + vstart, vlen)
      request.headers[name.toLowerCase()] = value
      hoff += 4
    }
    if (request.headers['content-length']) {
      request.size = parseInt(request.headers['content-length'], 10)
    } else {
      throw new Error('no content length header found')
    }
    headers_done = true
    if (bytes > parsed) request.body.push(recv_buf.slice(parsed, bytes))
    off = 0
  } else if (parsed === -1) {
    throw new Error(`HTTP Parse Error ${parsed}`)
  } else if (parsed === -2) {
    off += bytes
  }
  bytes = SSL_read(ssl, start + off, len - off)
}

if (bytes < 0) {
  console.error(system.strerror())
  system.exit(1)
}

close(fd)
SSL_free(ssl)
SSL_CTX_free(ssl_context)

request.bodySize = request.body.reduce((p, c) => p + c.length, 0)
delete request.body

spin.print(JSON.stringify(request, null, '  '))

