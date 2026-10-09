import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { Stats } from 'lib/bench.js'

const { assert, core, getenv, ptr } = lo
const { fcntl, O_NONBLOCK, F_SETFL } = core
const { 
  socket, bind, listen, accept, close, setsockopt, recv2, send2
} = net
const {
  SOCK_STREAM, AF_INET, SOMAXCONN, SO_REUSEPORT, SOL_SOCKET, SOCKADDR_LEN, TCP_NODELAY, IPPROTO_TCP
} = net
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
  const bytes = recv2(fd, recv_buf.ptr, BUFSIZE, 0)
  if (bytes > 0) {
//    console.log(dump(recv_buf.subarray(0, bytes)))
    stats.recv += bytes 
    const written = send2(fd, recv_buf.ptr, bytes, 0)
    if (written !== bytes) throw new Error('partial write')
    stats.send += bytes
    stats.rps++
    return
  }
  if (bytes < 0 && lo.errno === Blocked) return
  close_socket(fd)
}

function on_socket_connect (sfd) {
  // we could use accept4 on linux and set non blocking here but macos does not have it
  const fd = accept(sfd, 0, 0)
  if (fd > 0) {
//    assert(!setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, net.on, 4))
    assert(fcntl(fd, F_SETFL, O_NONBLOCK) === 0)
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
  assert(fcntl(fd, F_SETFL, O_NONBLOCK) === 0)
  assert(!setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, net.on.ptr, 32))
  assert(bind(fd, sockaddr_in(addr, port).ptr, SOCKADDR_LEN) === 0)
  assert(listen(fd, SOMAXCONN) === 0)
  assert(loop.add(fd, on_socket_connect, Loop.Readable, on_accept_error) === 0)
  return fd
}

// allocate one big buffer and give sockets slices off it
// or just use same buffer for all sockets and copy when needed
// we could just use pointers and offsets
// it would still be jumping around a lot
const BUFSIZE = parseInt(getenv('BUFSIZE') || 256 * 1024, 10);
const loop = new Loop()
const recv_buf = ptr(new Uint8Array(BUFSIZE))
const stats = new Stats()
const timer = new Timer(loop, 1000, on_timer)
const address = getenv('ADDRESS') || '127.0.0.1'
const port = parseInt(getenv('PORT') || 3000, 10)
console.log(`listening on ${address}:${port}`)
const fd = start_server(address, port)
while (loop.poll() > 0) {}
timer.close()
close(fd)
