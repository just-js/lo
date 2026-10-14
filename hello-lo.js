import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { Stats } from 'lib/stats.js'
import { Timer } from 'lib/timer.js'
import { pico } from 'lib/pico.js'

const {
  assert, core, getenv, ptr, utf8EncodeIntoAtOffset, utf8Length, latin1Decode
} = lo
const { fcntl, O_NONBLOCK, F_SETFL, memmove, memcpy } = core
const {
  socket, bind, listen, accept, close, setsockopt, recv, send, shutdown
} = net
const {
  SOCK_STREAM, AF_INET, SOMAXCONN, SO_REUSEPORT, SOL_SOCKET, SOCKADDR_LEN,
  SHUT_WR, MSG_NOSIGNAL
} = net
const { sockaddr_in } = net.types
const { Blocked } = Loop
const { parse_request } = pico
// strict chunked decoding (RFC 9112 7.1): lib/chunked, built into the runtime
const { chunked } = lo.load('chunked')
const decode_chunked = chunked.decode

function update_headers () {
  plaintext = `content-type: text/plain;charset=utf-8\r\nDate: ${(new Date()).toUTCString()}\r\n`
}

function on_timer () {
  stats.log()
  update_headers()
}

function status_line (status = 200, message = 'OK') {
  return `HTTP/1.1 ${status} ${message}\r\n`
}

function close_socket (fd) {
  if (!sockets.has(fd)) return
  const socket = sockets.get(fd)
  if (fd > 0) {
    loop.remove(fd)
    close(fd)
    stats.conn--
  }
  socket.fd = 0
}

// parse one request head at buf[off..len): phr_parse_request writes the
// method/path pointers, lengths and headers into the shared arrays below.
// num_headers is in/out (capacity in, count out), so reset it every call
function parse_head (buf, off, len) {
  num_headers[0] = MAX_HEADERS
  return parse_request(buf.ptr + off, len - off, method.ptr, method_len.ptr,
    path.ptr, path_len.ptr, minor_version.ptr, headers.ptr, num_headers.ptr, 0)
}

// header name at buf[off..] equals `lower` (lowercase), ignoring case.
// b | 0x20 only maps letters onto lowercase letters, and '-' to itself
function name_is (buf, off, lower) {
  for (let i = 0; i < lower.length; i++) {
    if ((buf[off + i] | 0x20) !== lower[i]) return false
  }
  return true
}

// buf[off..] starts with exactly the bytes of `b`
function bytes_are (buf, off, b) {
  for (let i = 0; i < b.length; i++) {
    if (buf[off + i] !== b[i]) return false
  }
  return true
}

// Host value (RFC 9112 3.2, RFC 3986 3.2.2-3.2.3): uri-host [ ":" port ],
// where uri-host is an IP-literal in brackets or a reg-name/IPv4 address.
// no userinfo ('@'), path, list (','), whitespace or empty value
function valid_host (buf, off, len) {
  if (len === 0) return false
  let i = 0
  if (buf[off] === 91) {
    for (i = 1; i < len && buf[off + i] !== 93; i++) {
      if (!IP_LITERAL_CHAR[buf[off + i]]) return false
    }
    if (i === len) return false
    i++
  } else {
    while (i < len && REG_NAME_CHAR[buf[off + i]]) i++
    if (i === 0) return false
  }
  if (i === len) return true
  if (buf[off + i] !== 58) return false
  for (i++; i < len; i++) {
    const c = buf[off + i]
    if (c < 48 || c > 57) return false
  }
  return true
}

// Connection (RFC 9112 9.3, 9.6): a comma list; "close" ends the connection
// after this response, "keep-alive" keeps an HTTP/1.0 connection open
function read_connection (buf, off, len) {
  let i = 0
  while (i < len) {
    while (i < len && (buf[off + i] === 32 || buf[off + i] === 9 || buf[off + i] === 44)) i++
    const start = i
    while (i < len && buf[off + i] !== 44 && buf[off + i] !== 32 && buf[off + i] !== 9) i++
    const n = i - start
    if (n === 5 && name_is(buf, off + start, CLOSE)) {
      keep_alive = false
      return
    }
    if (n === 10 && name_is(buf, off + start, KEEP_ALIVE)) keep_alive = true
  }
}

// request-target (RFC 9112 3.2): origin-form or absolute-form, all bytes
// from RFC 3986 (no space, CTL, non-ASCII, '"', '<', '>', '\', '^', '`',
// '{', '|', '}', '#'), every '%' followed by two hex digits
function valid_target (buf, off, len) {
  for (let i = 0; i < len; i++) {
    const c = buf[off + i]
    if (!TARGET_CHAR[c]) return false
    if (c === 37) {
      if (i + 2 >= len || !HEX_CHAR[buf[off + i + 1]] || !HEX_CHAR[buf[off + i + 2]]) return false
      i += 2
    }
  }
  return true
}

// RFC 9112 checks on a parsed head, with one pass over the headers. sets
// framing and content_length (6.3), keep_alive and conn_header (9.3) and
// returns null, or returns the error response for an invalid head:
// - a folded header line (obs-fold, 5.2): 400
// - Content-Length not 1*DIGIT or duplicated with another value,
//   Transfer-Encoding other than exactly "chunked" or repeated, both of
//   them, or Transfer-Encoding on HTTP/1.0 (6.1, 6.3): 400
// - Host (3.2): HTTP/1.1 needs exactly one, and any Host must be valid: 400
// - request-target (3.2): a CONNECT (authority-form) gets 501; '*' with
//   anything but OPTIONS, or bytes outside RFC 3986: 400
function read_head (buf, base) {
  const n = num_headers[0]
  const http11 = minor_version[0] === 1
  let cl = -1
  let te = false
  let hosts = 0
  keep_alive = http11
  for (let i = 0, h = 0; i < n; i++, h += 8) {
    const name_len = headers[h + 2]
    // picohttpparser returns a continuation line as a header with no name
    if (name_len === 0) return BAD_REQUEST
    if (name_len === 4) {
      if (!name_is(buf, (headers[h] - base) >>> 0, HOST)) continue
      hosts++
      if (!valid_host(buf, (headers[h + 4] - base) >>> 0, headers[h + 6])) return BAD_REQUEST
    } else if (name_len === 10) {
      if (!name_is(buf, (headers[h] - base) >>> 0, CONNECTION)) continue
      read_connection(buf, (headers[h + 4] - base) >>> 0, headers[h + 6])
    } else if (name_len === 14) {
      if (!name_is(buf, (headers[h] - base) >>> 0, CONTENT_LENGTH)) continue
      const voff = (headers[h + 4] - base) >>> 0
      const vlen = headers[h + 6]
      if (vlen === 0 || vlen > 15) return BAD_REQUEST
      let v = 0
      for (let j = 0; j < vlen; j++) {
        const c = buf[voff + j] - 48
        if (c < 0 || c > 9) return BAD_REQUEST
        v = v * 10 + c
      }
      if (cl !== -1 && cl !== v) return BAD_REQUEST
      cl = v
    } else if (name_len === 17) {
      if (!name_is(buf, (headers[h] - base) >>> 0, TRANSFER_ENCODING)) continue
      if (te || headers[h + 6] !== 7) return BAD_REQUEST
      if (!name_is(buf, (headers[h + 4] - base) >>> 0, CHUNKED_TOKEN)) return BAD_REQUEST
      te = true
    }
  }
  if (hosts > 1 || (http11 && hosts === 0)) return BAD_REQUEST
  const moff = (method[0] - base) >>> 0
  const mlen = method_len[0]
  const poff = (path[0] - base) >>> 0
  const plen = path_len[0]
  if (mlen === 7 && bytes_are(buf, moff, CONNECT)) return NOT_IMPLEMENTED
  if (buf[poff] === 42) {
    if (plen !== 1 || mlen !== 7 || !bytes_are(buf, moff, OPTIONS)) return BAD_REQUEST
  } else if (!valid_target(buf, poff, plen)) {
    return BAD_REQUEST
  }
  conn_header = keep_alive ? (http11 ? '' : KEEP_ALIVE_HEADER) : CLOSE_HEADER
  if (te) {
    if (cl !== -1 || !http11) return BAD_REQUEST
    framing = FRAME_CHUNKED
    return null
  }
  framing = cl > 0 ? FRAME_LENGTH : FRAME_NONE
  content_length = cl
  return null
}

// an incomplete head whose method is already longer than any we accept
function method_too_long (buf, off, len) {
  if (len - off <= MAX_METHOD) return false
  for (let i = 0; i <= MAX_METHOD; i++) {
    if (buf[off + i] === 32) return false
  }
  return true
}

function head_string (body_len) {
  return `${status_line()}${plaintext}${conn_header}Content-Length: ${body_len}\r\n\r\n`
}

function write_head (body_len, out) {
  return out + utf8EncodeIntoAtOffset(head_string(body_len), wbuf.ptr, out)
}

// bytes at buf[off..off+len) are exactly `route`, or `route` then a
// query ('?'): used for paths and, with len === route.length, the method
function route_is (buf, off, len, route) {
  const n = route.length
  if (len !== n && (len < n || buf[off + n] !== 63)) return false
  for (let i = 0; i < n; i++) {
    if (buf[off + i] !== route[i]) return false
  }
  return true
}

// GET|POST /echo: the request headers as they arrived, one
// "name: value\n" line each, copied from the read buffer
function echo_headers (buf, base, out, head_only) {
  const n = num_headers[0]
  let body_len = 0
  for (let h = 0; h < n * 8; h += 8) body_len += headers[h + 2] + headers[h + 6] + 3
  out = write_head(body_len, out)
  if (head_only) return out
  for (let h = 0; h < n * 8; h += 8) {
    const name_len = headers[h + 2]
    const value_len = headers[h + 6]
    memcpy(wbuf.ptr + out, buf.ptr + ((headers[h] - base) >>> 0), name_len)
    out += name_len
    wbuf[out++] = 58
    wbuf[out++] = 32
    memcpy(wbuf.ptr + out, buf.ptr + ((headers[h + 4] - base) >>> 0), value_len)
    out += value_len
    wbuf[out++] = 10
  }
  return out
}

// GET /cookie: every Cookie header's pairs as "name=value\n" lines
function echo_cookies (buf, base, out, head_only) {
  const n = num_headers[0]
  let text = ''
  for (let h = 0; h < n * 8; h += 8) {
    if (headers[h + 2] !== 6 || !name_is(buf, (headers[h] - base) >>> 0, COOKIE_NAME)) continue
    const value = latin1Decode(buf.ptr + ((headers[h + 4] - base) >>> 0), headers[h + 6])
    for (const pair of value.split(';')) {
      const trimmed = pair.trimStart()
      const eq = trimmed.indexOf('=')
      if (eq > 0) text += `${trimmed.slice(0, eq)}=${trimmed.slice(eq + 1)}\n`
    }
  }
  out = write_head(utf8Length(text), out)
  if (head_only) return out
  return out + utf8EncodeIntoAtOffset(text, wbuf.ptr, out)
}

// answer the request; the body (if any) is buf[body_off..body_off+body_len).
// routes as in Http11Probe's reference servers (src/Servers/BunServer):
// /echo, /cookie, POST echoes its body, anything else gets the hello text.
// HEAD gets the same headers as GET and no body (RFC 9110 9.3.2)
function respond (socket, body_off, body_len, out) {
  const { buf, base } = socket
  stats.rps++
  const mlen = method_len[0]
  const head_only = mlen === 4 && bytes_are(buf, (method[0] - base) >>> 0, HEAD)
  const plen = path_len[0]
  if (plen >= 5) {
    const poff = (path[0] - base) >>> 0
    if (route_is(buf, poff, plen, ECHO)) return echo_headers(buf, base, out, head_only)
    if (route_is(buf, poff, plen, COOKIE)) return echo_cookies(buf, base, out, head_only)
  }
  if (mlen === 4 && bytes_are(buf, (method[0] - base) >>> 0, POST)) {
    out = write_head(body_len, out)
    memcpy(wbuf.ptr + out, buf.ptr + body_off, body_len)
    return out + body_len
  }
  if (head_only) return write_head(HELLO.length, out)
  return out + utf8EncodeIntoAtOffset(`${head_string(HELLO.length)}${HELLO}`, wbuf.ptr, out)
}

// send wbuf[0..out). what the kernel doesn't take (partial write or
// EAGAIN) is copied to the socket's write queue, and the socket switches
// to EPOLLOUT only: it stops reading until the queue drains
// (backpressure). returns true when everything was sent; false when
// queued, or when the socket was closed on a send error
function flush (fd, socket, out) {
  let n = send(fd, wbuf.ptr, out, MSG_NOSIGNAL)
  if (n === out) return true
  if (n < 0) {
    if (lo.errno !== Blocked) {
      close_socket(fd)
      return false
    }
    n = 0
  }
  const rest = out - n
  if (socket.wq === null) socket.wq = ptr(new Uint8Array(WBUFSIZE))
  memcpy(socket.wq.ptr, wbuf.ptr + n, rest)
  socket.wq_off = 0
  socket.wq_len = rest
  loop.modify(fd, on_socket_writable, Loop.Writable, close_socket)
  return false
}

// EPOLLOUT while the write queue holds data: send more of it. once it's
// empty, shut down if the connection was finishing, else go back to
// reading, after answering the requests still in the buffer
function on_socket_writable (fd) {
  const socket = sockets.get(fd)
  const n = send(fd, socket.wq.ptr + socket.wq_off, socket.wq_len, MSG_NOSIGNAL)
  if (n < 0) {
    if (lo.errno !== Blocked) close_socket(fd)
    return
  }
  socket.wq_off += n
  socket.wq_len -= n
  if (socket.wq_len > 0) return
  loop.modify(fd, on_socket_event, Loop.Readable, close_socket)
  if (socket.closing) {
    shutdown(fd, SHUT_WR)
    return
  }
  if (socket.len > 0) process_buffer(fd, socket)
}

// stop reading requests, send what's queued, then shut down our side (once
// the write queue has drained, if it had to queue); the read handler
// discards input until the peer closes
function finish (fd, socket, out) {
  socket.closing = true
  socket.len = 0
  if (out > 0 && !flush(fd, socket, out)) return
  shutdown(fd, SHUT_WR)
}

// queue an error response after anything already queued and finish
function fail (fd, socket, response, out) {
  finish(fd, socket, out + utf8EncodeIntoAtOffset(response, wbuf.ptr, out))
}

// answer the requests in buf[0..socket.len): every response goes into
// wbuf and is sent with one send() (like Bun's cork). unparsed bytes stay
// in the buffer for the next read, so a request split across reads, or
// pipelined, is handled. a Content-Length body is waited for by parsing
// the head again on the next read; a chunked body is decoded in place as
// it arrives (socket.head is the head's length, socket.dec the decoded
// end, both from the request start). after a response that closes the
// connection nothing more is read (RFC 9112 9.6). if a send can't complete,
// processing stops with the remaining requests kept in the buffer, and
// on_socket_writable resumes it
function process_buffer (fd, socket) {
  const { buf } = socket
  let len = socket.len
  let off = 0
  let out = 0
  while (off < len) {
    if (socket.head > 0) {
      // chunked body in progress
      const dec_off = off + socket.dec
      size[0] = len - dec_off
      const rc = decode_chunked(socket.decoder.ptr, buf.ptr + dec_off, size.ptr)
      if (rc === -1) return fail(fd, socket, BAD_REQUEST, out)
      socket.dec += size[0]
      if (rc === -2) {
        len = off + socket.dec
        if (len - off === BUFSIZE) return fail(fd, socket, TOO_LARGE, out)
        break
      }
      // done: the rc bytes after the body were moved to follow it. parse
      // the head again: other sockets have used the shared arrays since
      const head = socket.head
      const end = off + socket.dec
      len = end + rc
      socket.head = 0
      parse_head(buf, off, off + head)
      read_head(buf, socket.base)
      out = respond(socket, off + head, socket.dec - head, out)
      off = end
    } else {
      const parsed = parse_head(buf, off, len)
      if (parsed === -2) {
        if (method_too_long(buf, off, len)) return fail(fd, socket, BAD_REQUEST, out)
        if (len - off === BUFSIZE) return fail(fd, socket, HEAD_TOO_LARGE, out)
        break
      }
      if (parsed < 0) return fail(fd, socket, BAD_REQUEST, out)
      const error = read_head(buf, socket.base)
      if (error !== null) return fail(fd, socket, error, out)
      if (framing === FRAME_NONE) {
        out = respond(socket, 0, 0, out)
        off += parsed
      } else if (framing === FRAME_LENGTH) {
        if (parsed + content_length > BUFSIZE) return fail(fd, socket, TOO_LARGE, out)
        if (len - off < parsed + content_length) break
        out = respond(socket, off + parsed, content_length, out)
        off += parsed + content_length
      } else {
        socket.head = socket.dec = parsed
        socket.decoder.fill(0)
        continue
      }
    }
    if (!keep_alive) return finish(fd, socket, out)
    if (out > WBUF_FLUSH) {
      const sent = flush(fd, socket, out)
      out = 0
      if (!sent) break
    }
  }
  if (off > 0 && off < len) memmove(buf.ptr, buf.ptr + off, len - off)
  socket.len = len - off
  if (out > 0) flush(fd, socket, out)
}

function on_socket_event (fd) {
  const socket = sockets.get(fd)
  const bytes = recv(fd, socket.buf.ptr + socket.len, BUFSIZE - socket.len, 0)
  if (bytes > 0) {
    if (socket.closing) return
    socket.len += bytes
    process_buffer(fd, socket)
    return
  }
  if (bytes < 0 && lo.errno === Blocked) return
  close_socket(fd)
}

function create_socket (fd) {
  const buf = ptr(new Uint8Array(BUFSIZE))
  return {
    buf, base: buf.ptr >>> 0, len: 0, fd, closing: false, head: 0, dec: 0,
    // write queue (allocated on first use): wq[wq_off..wq_off+wq_len)
    wq: null, wq_off: 0, wq_len: 0,
    decoder: ptr(new Uint8Array(chunked.struct_chunked_decoder_size))
  }
}

function on_socket_connect (sfd) {
  // we could use accept4 on linux and set non blocking here but macos does not have it
  const fd = accept(sfd, 0, 0)
  if (fd > 0) {
    assert(fcntl(fd, F_SETFL, O_NONBLOCK) === 0)
    sockets.set(fd, create_socket(fd))
    assert(loop.add(fd, on_socket_event, Loop.Readable, close_socket) === 0)
    stats.conn++
    return
  }
  if (lo.errno === Blocked) return
  close(fd)
}

function on_accept_error(fd, mask) {
  console.log(`accept error on socket ${fd} : ${mask}`)
}

function start_server (addr, port) {
  const fd = socket(AF_INET, SOCK_STREAM, 0)
  assert(fd > 2)
//  assert(fcntl(fd, F_SETFL, O_NONBLOCK) === 0)
  assert(!setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, net.on.ptr, 32))
  assert(bind(fd, sockaddr_in(addr, port).ptr, SOCKADDR_LEN) === 0)
  assert(listen(fd, SOMAXCONN) === 0)
  assert(loop.add(fd, on_socket_connect, Loop.Readable, on_accept_error) === 0)
  return fd
}

// a byte -> allowed table from character ranges ('a-z') and single chars
function char_table (...sets) {
  const t = new Uint8Array(256)
  for (const set of sets) {
    if (set.length === 3 && set[1] === '-') {
      for (let c = set.charCodeAt(0); c <= set.charCodeAt(2); c++) t[c] = 1
    } else {
      for (const ch of set) t[ch.charCodeAt(0)] = 1
    }
  }
  return t
}

const sockets = new Map()
// one request (head + body) must fit: larger gets 413 (431 for a head)
const BUFSIZE = 65536
// responses for one read go here; flushed early past WBUF_FLUSH, so the
// headroom above it must fit the largest single response. a socket's write
// queue is the same size: it holds at most one flush
const WBUFSIZE = 4 * BUFSIZE
const WBUF_FLUSH = 2 * BUFSIZE
const wbuf = ptr(new Uint8Array(WBUFSIZE))
const MAX_HEADERS = 64
// longest method accepted, so a request line that is all method fails early
const MAX_METHOD = 32
// phr_parse_request outputs: pointers and size_t are 64 bit (two u32s);
// a phr_header is { name, name_len, value, value_len }, 8 u32s. header
// offsets in a socket's buf are (low 32 bits of pointer - socket.base)
const method = ptr(new Uint32Array(2))
const method_len = ptr(new Uint32Array(2))
const path = ptr(new Uint32Array(2))
const path_len = ptr(new Uint32Array(2))
const minor_version = ptr(new Uint32Array(1))
const num_headers = ptr(new Uint32Array(2))
const headers = ptr(new Uint32Array(8 * MAX_HEADERS))
// chunked.decode's in/out size_t
const size = ptr(new Uint32Array(2))
const bytes = s => new Uint8Array([...s].map(c => c.charCodeAt(0)))
const CONTENT_LENGTH = bytes('content-length')
const TRANSFER_ENCODING = bytes('transfer-encoding')
const CHUNKED_TOKEN = bytes('chunked')
const HOST = bytes('host')
const CONNECTION = bytes('connection')
const CLOSE = bytes('close')
const KEEP_ALIVE = bytes('keep-alive')
const ECHO = bytes('/echo')
const COOKIE = bytes('/cookie')
const COOKIE_NAME = bytes('cookie')
// methods are case-sensitive: compared exactly
const POST = bytes('POST')
const HEAD = bytes('HEAD')
const CONNECT = bytes('CONNECT')
const OPTIONS = bytes('OPTIONS')
// RFC 3986: unreserved, sub-delims except ',' and pct-encoded's '%'
const REG_NAME_CHAR = char_table('a-z', 'A-Z', '0-9', '-._~', '!$&\'()*+;=%')
// IPv6 / IPvFuture inside "[...]"
const IP_LITERAL_CHAR = char_table('a-f', 'A-F', '0-9', ':.', 'v')
// pchar plus '/', '?' (origin-form, absolute-form, '[' ']' for IP-literals)
const TARGET_CHAR = char_table('a-z', 'A-Z', '0-9', '-._~', '!$&\'()*+,;=', ':@/?%[]')
const HEX_CHAR = char_table('a-f', 'A-F', '0-9')
const HELLO = 'Hello, World!'
const FRAME_NONE = 0
const FRAME_LENGTH = 1
const FRAME_CHUNKED = 2
// read_head results for the current request
let framing = FRAME_NONE
let content_length = -1
let keep_alive = true
let conn_header = ''
const CLOSE_HEADER = 'Connection: close\r\n'
const KEEP_ALIVE_HEADER = 'Connection: keep-alive\r\n'
const BAD_REQUEST = 'HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'
const TOO_LARGE = 'HTTP/1.1 413 Content Too Large\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'
const HEAD_TOO_LARGE = 'HTTP/1.1 431 Request Header Fields Too Large\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'
const NOT_IMPLEMENTED = 'HTTP/1.1 501 Not Implemented\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'
const loop = new Loop()
let plaintext =
  `content-type: text/plain;charset=utf-8\r\nDate: ${(new Date()).toUTCString()}\r\n`
const stats = new Stats()
const timer = new Timer(loop, 1000, on_timer)
const address = getenv('ADDRESS') || '127.0.0.1'
const port = parseInt(getenv('PORT') || 3000, 10)
const fd = start_server(address, port)
// 6 ms from cold start
console.log(stats.runtime)
while (loop.poll() > 0) {}
console.log('done')
timer.close()
close(fd)
