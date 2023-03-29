import { net } from 'lib/net.js'
import { system } from 'lib/system.js'
import { Loop } from 'lib/loop.js'
import { pico } from 'lib/pico.js'

const { SystemError } = system
const { AF_INET, SOCK_STREAM, SOCK_NONBLOCK, MSG_NOSIGNAL } = net.constants
const { EINPROGRESS, EAGAIN } = system.constants

class WebSocket {
  fd = 0
  state = new spin.RawBuffer(32 + (32 * 14))
  loop = undefined
  roff = 0
  woff = 0

  constructor (port = 3000, address = '127.0.0.1', loop, max = 64 * 1024) {
    this.sockaddr = net.types.sockaddr_in(address, port)
    this.address = this.sockaddr.address
    this.loop = loop
    // TODO: "grow" the buffer dynamically up to a limit based on max size of message seen
    // TODO: check all overflows/bounds
    this.rb = new spin.RawBuffer(max)
  }

  onopen () {}
  onmessage () {}
  onclose () {}
  onerror () {}

  close () {
    net.close(this.fd)
    this.onclose()
  }

  static createMessage (size) {
    let header
    if (size < 126) {
      header = new Uint8Array([0x82, (size & 0xff) + 128])
      size += 6
    }
    if (size < 65536) {
      header = new Uint8Array([0x82, 126 + 128, size >>> 8, size & 0xff])
      size += 8
    } else {
      header = new Uint8Array(14)
      header[0] = 0x82
      header[1] = 127 + 128
      let l = size
      for (let i = 9; i > 1; i--) {
        header[i] = l & 0xff
        l >>>= 8
      }
      size += 14
    }
    const rb = new spin.RawBuffer(size)
    rb.u8.set(header, 0)
    return rb
  }

  onReadable () {
    const { fd, rb } = this
    const { u8 } = rb
    const bytes = net.recv(fd, rb.ptr + this.roff, rb.size - this.roff, 0)
    if (bytes > 0) {
      this.roff += bytes
      let len = u8[1] & 0x7f
      if (len === 126) {
        len = (u8[2] << 8) + u8[3]
        if (len + 4 <= this.roff) {
          this.roff = 0
          this.onmessage(len)
        }
      } else if (len === 127) {
        const l1 = (u8[2] << 24) + (u8[3] << 16) + (u8[4] << 8) + u8[5]
        const l2 = (u8[6] << 24) + (u8[7] << 16) + (u8[8] << 8) + u8[9]
        len = (l1 << 32) + l2
        if (len + 10 <= this.roff) {
          this.roff = 0
          this.onmessage(len)
        }
      } else if (len + 2 <= this.roff) {
        this.roff = 0
        this.onmessage(len)
      }
      return
    }
    if (bytes < 0 && system.errno === EAGAIN) return
    this.close()
  }

  send (buf, bytes = buf.size) {
    const { fd, loop } = this
    const towrite = bytes - this.woff
    const written = net.send(fd, buf.ptr + this.woff, towrite, MSG_NOSIGNAL)
    if (written === towrite) {
      this.woff = 0
      return
    }
    if (written === -1) {
      if (system.errno === EAGAIN) {
        this.woff = 0
        loop.modify(fd, Loop.Writable | Loop.EdgeTriggered, () => {
          loop.modify(fd, Loop.Readable, () => this.onReadable())
          this.send(buf, bytes)
        })
        return
      }
      this.close()
      return
    }
    this.woff += written
    loop.modify(fd, Loop.Writable | Loop.EdgeTriggered, () => {
      loop.modify(fd, Loop.Readable, () => this.onReadable())
      this.send(buf, bytes)
    })
  }

  connect () {
    const { state, roff, loop, address } = this
    const rb = new spin.RawBuffer(1024)
    const fd = net.socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
    spin.assert(fd > 0, 'net.socket', SystemError)
    let rc = net.connect(fd, address, 16)
    spin.assert((rc > 0 || system.errno === EINPROGRESS), 'socket', SystemError)
    rc = loop.add(fd, () => {
      loop.modify(fd, Loop.Readable, () => {
        // TODO EAGAIN
        const bytes = net.recv(fd, rb.ptr + roff, rb.size - roff, 0)
        if (bytes > 0) {
          this.roff += bytes
          const nread = pico.parseResponse(rb.ptr, this.roff, state.ptr)
          if (nread > 0) {
            loop.callbacks[fd] = () => this.onReadable()
            this.roff = 0
            this.onopen()
          }
          return
        }
        this.close()
      })
      const CR = String.fromCharCode(13)
      const hs = `GET / HTTP/1.1${CR}
Upgrade: websocket${CR}
Connection: Upgrade${CR}
Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==${CR}
Host: localhost${CR}
Sec-WebSocket-Version: 13${CR}
${CR}
`
      const handshake = spin.RawBuffer.fromBuffer(spin.calloc(1, hs))
      this.send(handshake)
    }, Loop.Writable | Loop.EdgeTriggered, () => this.onerror())
    spin.assert(rc === 0, 'loop.add', SystemError)
    this.fd = fd
  }
}

export { WebSocket }
