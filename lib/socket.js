import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'

const { assert } = spin
const {
  socket, connect, close, send, recv, bind, listen, accept4
} = net
const { 
  SOCK_STREAM, AF_INET, SOCK_NONBLOCK, SOCKADDR_LEN, O_NONBLOCK, MSG_NOSIGNAL,
  SOMAXCONN
} = net.constants
const { sockaddr_in } = net.types
const EAGAIN = 11
const EINPROGRESS = 115

const SocketStates = {
  closed: 0,
  opening: 1,
  open: 2,
  bound: 3,
  listening: 4
}

const SocketModes = {
  none: 0,
  readable: 1,
  writable: 2
}

class Socket {
  fd = 0
  loop
  state = SocketStates.closed
  mode = SocketModes.none

  constructor (loop) {
    this.loop = loop
  }

  bind (port = 3000, address = '127.0.0.1') {
    const sock = this
    if (!this.fd) {
      const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
      assert(fd !== -1)
      this.fd = fd
    }
    const { fd } = this
    assert(!bind(fd, sockaddr_in(address, port), SOCKADDR_LEN))
    sock.state = SocketStates.bound
  }

  listen (backlog = SOMAXCONN) {
    const { fd, loop } = this
    assert(fd)
    assert(!listen(fd, backlog))
    this.state = SocketStates.listening
  }

  async accept () {
    const { fd, loop } = this
    const newfd = accept4(fd, 0, 0, O_NONBLOCK)
    if (newfd > 0) {
      const sock = new Socket(loop)
      sock.fd = newfd
      await sock.writable()
      return sock
    }
    if (newfd === -1 && (spin.errno === EAGAIN)) {
      await this.readable()
      return this.accept()
    }
    console.log('unknown accept errror')
  }

  connect (port = 3000, address = '127.0.0.1') {
    const sock = this
    const { loop } = sock
    const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
    assert(fd !== -1)
    this.fd = fd
    assert(!(connect(fd, sockaddr_in(address, port), SOCKADDR_LEN) < 0 && spin.errno !== EINPROGRESS))
    sock.state = SocketStates.opening
    return new Promise (resolve => {
      sock.mode = SocketModes.writable
      assert(!loop.add(fd, () => {
        sock.state = SocketStates.open
        resolve()
      }, Loop.Writable | Loop.EdgeTriggered))
    })
  }

  writable () {
    const { fd, loop } = this
    return new Promise (resolve => {
      this.mode = SocketModes.writable
      if (!loop.callbacks[fd]) {
        assert(!loop.add(fd, resolve, Loop.Writable | Loop.EdgeTriggered))
        return
      }
      if (this.mode === SocketModes.writable) {
        loop.callbacks[fd] = resolve
        return
      }
      assert(!loop.modify(fd, Loop.Writable | Loop.EdgeTriggered, resolve))
    })
  }

  readable () {
    const { fd, loop } = this
    return new Promise (resolve => {
      this.mode = SocketModes.readable
      if (!loop.callbacks[fd]) {
        assert(!loop.add(fd, resolve, Loop.Readable))
        return
      }
      if (this.mode === SocketModes.readable) {
        loop.callbacks[fd] = resolve
        return
      }
      assert(!loop.modify(fd, Loop.Readable, resolve))
    })
  }

  async recv (u8) {
    const { fd, loop } = this
    const received = recv(fd, u8, u8.length, 0)
    console.log(received)
    if (received > 0) return received
    if (received === -1 && (spin.errno === EAGAIN)) {
      await this.readable()
      return this.recv(u8)
    }
    this.close()
  }

  async send (u8) {
    const { fd } = this
    const written = send(fd, u8, u8.length, MSG_NOSIGNAL)
    if (written === u8.length) return
    if (written === -1 && (spin.errno === EAGAIN)) {
      await this.writable()
      return this.send(u8)
    }
    if (written > 0) {
      await this.writable()
      return this.send(u8.subarray(written))
    }
    this.close()
  }

  close () {
    if (this.state === SocketStates.closed) return
    const { fd, loop } = this
    loop.remove(fd)
    close(fd)
    this.state === SocketStates.closed
  }
}

export { Socket, SocketStates }
