import { Loop } from 'lib/loop.js'
import { net } from 'lib/net.js'
import { system } from 'lib/system.js'

const { SystemError } = system
const { AF_INET, SOCK_STREAM, SOCK_NONBLOCK, MSG_NOSIGNAL } = net.constants
const { EINPROGRESS, EAGAIN } = system.constants
const { Readable, Writable, EdgeTriggered } = Loop

class Socket {
  fd = 0
  offset = 0
  flags = Writable | EdgeTriggered
  sockaddr = undefined
  loop = undefined

  constructor (loop) {
    this.loop = loop
  }

  // todo: make blocking/non-blocking an option
  async connect (port = 3000, address = '127.0.0.1') {
    if (!this.sockaddr) this.sockaddr = net.types.sockaddr_in(address, port)
    const fd = net.socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
    if (fd < 0) throw new SystemError('net.socket')
    const rc = net.connect(fd, this.sockaddr, 16)
    if (rc < 0 && spin.errno !== EINPROGRESS) throw new SystemError('net.connect')
    this.fd = fd
    await this.connected()
  }

  async send (buf, len = buf.length) {
    const { fd, offset } = this
    const towrite = len - offset
    system.errno = 0
    const written = net.send(fd, buf, towrite, 0)
    if (written === towrite) {
      this.offset = 0
      return written
    }
    if (written === -1) {
      if (spin.errno === EAGAIN) {
        await this.writable()
        return this.send(buf, len)
      }
      console.log('close')
      this.close()
      return 0
    }
    this.offset += written
    await this.writable()
    return this.send(buf, len)
  }

  async recv (buf) {
    const { fd } = this
    const bytes = net.recv(fd, buf, buf.length, 0)
    if (bytes > 0) return bytes
    if (bytes === -1) {
      if (spin.errno === EAGAIN) {
        await this.readable()
        return this.recv(buf)
      }
    }
    this.close()
    return 0
  }

  connected () {
    const { loop, fd } = this
    this.flags = Writable | EdgeTriggered
    return new Promise((resolve, reject) => {
      const rc = loop.add(fd, () => resolve(), this.flags)
      if (rc === -1) reject(new SystemError('loop.add'))
    })
  }

  writable () {
    //if (this.flags & Writable === Writable) return Promise.resolve(true)
    const { loop, fd } = this
    return new Promise((resolve, reject) => {
      const rc = loop.modify(fd, Writable | EdgeTriggered, () => resolve(true))
      if (rc === -1) reject(new SystemError('loop.modify'))
      this.flags = Writable | EdgeTriggered
    })
  }

  readable () {
    //if (this.flags & Readable === Readable) return Promise.resolve(true)
    const { loop, fd } = this
    return new Promise((resolve, reject) => {
      const rc = loop.modify(fd, Readable, () => resolve(true))
      if (rc === -1) reject(new SystemError('loop.modify'))
      this.flags = Readable
    })
  }

  close () {
    this.loop.remove(this.fd)
    return net.close(this.fd)
  }
}

export { Socket }
