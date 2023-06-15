import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'

const { assert } = spin
const { AG, AY, AD } = spin.colors
const {
  socket, setsockopt, bind, listen, close, accept4, send, recv, on
} = net
const { 
  SOCK_STREAM, AF_INET, SOCK_NONBLOCK, SOL_SOCKET, SO_REUSEPORT, 
  SOCKADDR_LEN, SOMAXCONN, O_NONBLOCK
} = net.constants
const { sockaddr_in } = net.types
const { EAGAIN } = net.constants

function onSocketEvent (fd) {
  const bytes = recv(fd, u8, BUFSIZE, 0)
  if (bytes > 0) {
    stats.recv += bytes
    const written = send(fd, u8, bytes, 0)
    if (written !== bytes) {
      console.log('uhoh')
    }
    stats.send += written
    return
  }
  if (bytes < 0 && spin.errno === EAGAIN) return
  if (bytes < 0) console.error('socket_error')
  stats.conn--
  eventLoop.remove(fd)
  close(fd)
}

function onConnect (sfd) {
  const fd = accept4(sfd, 0, 0, O_NONBLOCK)
  if (fd > 0) {
    stats.conn++
    eventLoop.add(fd, onSocketEvent)
    return
  }
  if (spin.errno === EAGAIN) return
  close(fd)
}

let conn = 0
const BUFSIZE = 65536
const u8 = new Uint8Array(BUFSIZE)
const address = '127.0.0.1'
const port = 3000
const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
assert(fd > 2)
assert(!setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, on, 32))
assert(!bind(fd, sockaddr_in(address, port), SOCKADDR_LEN))
assert(!listen(fd, SOMAXCONN))
const eventLoop = new Loop()
assert(!eventLoop.add(fd, onConnect))

const stats = {
  send: 0, recv: 0, conn: 0
}

const timer = new Timer(eventLoop, 1000, () => {
  console.log(`${AY}send${AD} ${stats.send} ${AY}recv${AD} ${stats.recv} ${AG}conn${AD} ${stats.conn}`)
  stats.send = stats.recv = 0
})

while (1) {
  spin.runMicroTasks()
  if (eventLoop.poll(-1) <= 0) break
}

timer.close()
net.close(fd)
