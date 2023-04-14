import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'

const { assert } = spin
const { AY, AD } = spin.colors
const {
  socket, setsockopt, bind, listen, close, accept4, send, recv, on
} = net
const { 
  SOCK_STREAM, AF_INET, SOCK_NONBLOCK, SOL_SOCKET, SO_REUSEPORT, 
  SOCKADDR_LEN, SOMAXCONN, O_NONBLOCK
} = net.constants
const { sockaddr_in } = net.types
const EAGAIN = 11

function onSocketEvent (fd) {
  const u8 = new Uint8Array(BUFSIZE)
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

const BUFSIZE = 65536
const u8 = new Uint8Array(BUFSIZE)
const address = '10.0.0.1'
const port = 3000
const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
assert(fd !== -1)
assert(!setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, on, 32))
assert(!bind(fd, sockaddr_in(address, port), SOCKADDR_LEN))
assert(!listen(fd, SOMAXCONN))
const eventLoop = new Loop()
assert(!eventLoop.add(fd, onConnect))

const stats = {
  send: 0, recv: 0
}

const timer = new Timer(eventLoop, 1000, () => {
  console.log(`${AY}send${AD} ${stats.send} ${AY}recv${AD} ${stats.recv}`)
  stats.send = stats.recv = 0
})

while (1) {
  spin.runMicroTasks()
  if (eventLoop.poll(-1) <= 0) break
}

timer.close()
net.close(fd)
