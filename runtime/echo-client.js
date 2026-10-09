import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { Stats } from 'lib/bench.js'

const { assert, getenv, ptr } = lo
const { socket, close, send2, recv2, connect, setsockopt } = net
const { SOCK_STREAM, AF_INET, SOCK_NONBLOCK, EINPROGRESS, SOCKADDR_LEN, TCP_NODELAY, IPPROTO_TCP } = net
const { sockaddr_in } = net.types
const { Blocked } = Loop

function on_timer () {
  stats.log()
}

function close_socket (fd) {
  if (fd > 0) {
    loop.remove(fd)
    close(fd)
    stats.conn--
  }
  socket.fd = 0
}

function on_socket_event (fd) {
  const bytes = recv2(fd, payload.ptr, BUFSIZE, 0)
  if (bytes > 0) {
    stats.recv += bytes 
    const written = send2(fd, payload.ptr, bytes, 0)
    if (written !== bytes) throw new Error('partial write')
    stats.send += bytes
    stats.rps++
    return
  }
  if (bytes < 0 && lo.errno === Blocked) return
  close_socket(fd)
}

function on_socket_connect (fd) {
//  assert(!setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, net.on, 4))
  assert(loop.modify(fd, on_socket_event, Loop.Readable, close_socket) === 0)
  send2(fd, payload.ptr, payload.length, 0)
  stats.send += payload.length
  stats.conn++
}

function start_client () {
  const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
  assert(fd > 2)
  assert(connect(fd, addr.ptr, SOCKADDR_LEN) === 0 || 
    lo.errno === EINPROGRESS)
  assert(loop.add(fd, on_socket_connect, Loop.Writable, 
    close_socket) === 0)
}

const stats = new Stats()
const BUFSIZE = parseInt(getenv('BUFSIZE') || 256 * 1024, 10);
const payload = ptr(new Uint8Array(BUFSIZE))
const address = getenv('ADDRESS') || '127.0.0.1'
const port = parseInt(getenv('PORT') || 3000, 10)
const addr = sockaddr_in(address, port)
const loop = new Loop()
const timer = new Timer(loop, 1000, on_timer)
console.log(`connecting to ${address}:${port}`)
const nclient = getenv('CLIENT') || parseInt(lo.args[2] || '64', 10)
for (let i = 0; i < nclient; i++) start_client()
while (loop.poll() > 0) {}
timer.close()
close(fd)
