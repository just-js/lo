import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { join } from 'lib/path.js'
import { isFile, readFile } from 'lib/fs.js'

const { assert, utf8Length, args, fs } = spin
const { pico } = spin.load('pico')
const {
  socket, setsockopt, bind, listen, close, accept4, send, recv, on
} = net
const { 
  SOCK_STREAM, AF_INET, SOCK_NONBLOCK, SOL_SOCKET, SO_REUSEPORT, 
  SOCKADDR_LEN, SOMAXCONN, O_NONBLOCK
} = net.constants
const { sockaddr_in } = net.types
const EAGAIN = 11
const HTTP_CTX_SZ = 32
const HTTP_HEADER_SZ = 32
const MAXHEADERS = 14
const BUFSIZE = 4096

const decoder = new TextDecoder()

class Request {
  method = ''
  path = ''
  headers = {}
  fd = 0
  minorVersion = 1

  constructor (state, u8, fd) {
    this.fd = fd
    const [path_len, , method_len, , num_headers, , minorVersion] = state
    const text = decoder.decode(u8)
    this.method = text.slice(0, method_len)
    this.path = text.slice(method_len + 1, method_len + 1 + path_len)
    const [, ...headers] = text.split('\r\n').slice(0, -2)
    this.headers = {}
    this.minorVersion = minorVersion
    for (const header of headers) {
      const [name, value] = header.split(': ')
      this.headers[name] = value
    }
  }

  json () {

  }

  text () {

  }
}

function getHeaders (type, u8) {
  if (type === 'text') {
    return `HTTP/1.1 200 OK\r\nDate: ${(new Date()).toUTCString()}\r\nContent-Type: text/plain;charset=utf8\r\nContent-Length: ${u8.length}\r\n\r\n`
  }
}

class Response {
  fd = 0
  status = 200
  statusMessage = 'OK'

  constructor (req) {
    this.fd = req.fd
  }

  text (text) {
    const payload = encoder.encode(text)
    const headers = encoder.encode(`HTTP/1.1 ${this.status} ${this.statusMessage}\r\nDate: ${(new Date()).toUTCString()}\r\nContent-Type: text/plain;charset=utf8\r\nContent-Length: ${payload.length}\r\n\r\n`)
    send(this.fd, headers, headers.length, 0)
    send(this.fd, payload, payload.length, 0)
  }
}

function serve (req) {
  let { path } = req
  if (path === '/' || path === '') path = '/index.html'
  const { method } = req
  const res = new Response(req)
  if (method !== 'GET') {
    res.status = 400
    res.statusMessage = 'Bad Request'
    res.text('')
    return
  }
  const fileName = join(homeDir, path.slice(1))
  if (!isFile(fileName)) {
    res.status = 404
    res.statusMessage = 'Not Found'
    res.text('')
    return
  }


  res.text('hello')
}


function onSocketEvent (fd) {
  const bytes = recv(fd, u8, BUFSIZE, 0)
  if (bytes > 0 && pico.parseRequest(u8.subarray(0, bytes), bytes, state) === bytes) {
    serve(new Request(state, u8, fd))
    return
  }
  if (bytes < 0 && spin.errno === EAGAIN) return
  if (bytes < 0) console.error('socket_error')
  eventLoop.remove(fd)
  close(fd)
}

function onConnect (sfd) {
  const fd = accept4(sfd, 0, 0, O_NONBLOCK)
  if (fd > 0) {
    eventLoop.add(fd, onSocketEvent)
    return
  }
  if (spin.errno === EAGAIN) return
  close(fd)
}

const sbuf = new Uint8Array(HTTP_CTX_SZ + (HTTP_HEADER_SZ * MAXHEADERS))
const state = new Uint32Array(sbuf.buffer)
const encoder = new TextEncoder()
const u8 = new Uint8Array(BUFSIZE)

const [ homeDir = './' ] = args.slice(2)
const address = '127.0.0.1'
const port = 3000
const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
assert(fd !== -1)
assert(!setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, on, 32))
assert(!bind(fd, sockaddr_in(address, port), SOCKADDR_LEN))
assert(!listen(fd, SOMAXCONN))
const eventLoop = new Loop()
assert(!eventLoop.add(fd, onConnect))

while (1) {
  spin.runMicroTasks()
  if (eventLoop.poll(-1) <= 0) break
}
