import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { parseHello } from 'lib/sni.js'

const { assert } = spin
const {
  socket, setsockopt, bind, listen, close, accept4, send, recv, on
} = net
const { 
  SOCK_STREAM, AF_INET, SOCK_NONBLOCK, SOL_SOCKET, SO_REUSEPORT, 
  SOCKADDR_LEN, SOMAXCONN, O_NONBLOCK
} = net.constants
const { sockaddr_in } = net.types
const EAGAIN = 11

function decode (bytes) {
  return String.fromCharCode.apply(null, new Uint16Array(bytes))
}

function onSocketEvent (fd) {
  const bytes = recv(fd, u8, BUFSIZE, 0)
  if (bytes > 0) {
    const tls = parseHello(u8.slice(0, bytes))
    // validate tls options - ciphers etc.
    //console.log(stringify(tls))
    const sni = tls.extensions[0]
    if (sni) {
      const hostname = decode(tls.extensions[0].name)
      console.log(hostname)
      return
    }
    // reject if SNI is not present
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

const BUFSIZE = 4096
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
