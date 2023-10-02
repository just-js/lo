import { Database } from 'lib/sqlite.js'
import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'

const { assert, utf8Length } = spin
const { pico } = spin.load('pico')
const {
  socket, setsockopt, bind, listen, close, accept4, send, recv, on
} = net
const { 
  SOCK_STREAM, AF_INET, SOCK_NONBLOCK, SOL_SOCKET, SO_REUSEPORT, 
  SOCKADDR_LEN, SOMAXCONN, O_NONBLOCK, EAGAIN
} = net.constants
const { sockaddr_in } = net.types

function onSocketEvent (fd) {
  const bytes = recv(fd, u8, 4096, 0)
  if (bytes > 0 && pico.parseRequest(u8, bytes, state) === bytes) {
    const text = `<h1>Hello From Bun on Fly!</h1><br><pre>${JSON.stringify(persons.all(), null, '\t')}</pre>`
    const res = encoder.encode(`${headers}Content-Length: ${utf8Length(text)}\r\n\r\n${text}`)
    send(fd, res, res.length, 0)
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

const sbuf = new Uint8Array(32 + (32 * 14))
const state = new Uint32Array(sbuf.buffer)
const encoder = new TextEncoder()
const u8 = new Uint8Array(4096)
const address = '127.0.0.1'
const port = 3000
const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
assert(fd !== -1)
assert(!setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, on, 32))
assert(!bind(fd, sockaddr_in(address, port), SOCKADDR_LEN))
assert(!listen(fd, SOMAXCONN))
const eventLoop = new Loop()
assert(!eventLoop.add(fd, onConnect))
const db = (new Database()).open('./db')
const persons = db.prepare('SELECT * FROM persons ORDER BY id DESC').compile('Person', true)
const headers = `HTTP/1.1 200 OK\r\nDate: ${(new Date()).toUTCString()}\r\nContent-Type: text/html; charset=utf-8\r\n`

while (1) {
  spin.runMicroTasks()
  if (eventLoop.poll(-1) <= 0) break
}
