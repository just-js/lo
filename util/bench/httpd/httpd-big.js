import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'

const { assert } = spin
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

function onSocketEvent (fd) {
  const bytes = recv(fd, u8, BUFSIZE, 0)
  if (bytes > 0 && pico.parseRequest(u8, bytes, state) === bytes) {
    send(fd, res, rsize, 0)
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

const state = new Uint8Array(HTTP_CTX_SZ + (HTTP_HEADER_SZ * MAXHEADERS))
const encoder = new TextEncoder()
const text = (new Array(1024 * 1024)).fill('A').join('')
const res = encoder.encode(`HTTP/1.1 200 OK\r\nDate: ${(new Date()).toUTCString()}\r\nContent-Type: text/plain;charset=utf8\r\nContent-Length: ${text.length}\r\n\r\n${text}`)
const rsize = res.length
const u8 = new Uint8Array(BUFSIZE)
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
