import { net } from 'lib/net.js'
import { system } from 'lib/system.js'
import { Loop } from 'lib/loop.js'
import { pico } from 'lib/pico.js'

const { ptr, assert } = lo
const { SystemError } = system
const { 
  AF_INET, SOCK_STREAM, SOCK_NONBLOCK, MSG_NOSIGNAL, EINPROGRESS, EAGAIN
} = net.constants

const encoder = new TextEncoder()

class WebSocket {
  fd = 0
  state = ptr(new Uint8Array(32 + (32 * 14)))
  loop = undefined
  roff = 0
  woff = 0

  constructor (port = 3000, address = '127.0.0.1', loop, max = 64 * 1024) {
    this.address = net.types.sockaddr_in(address, port)
    //this.address = this.sockaddr.address
    this.loop = loop
    // TODO: "grow" the buffer dynamically up to a limit based on max size of message seen
    // TODO: check all overflows/bounds
    this.rb = ptr(new Uint8Array(max))
  }

  onopen () {}
  onmessage (len) {}
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
    const rb = ptr(new Uint8Array((size)))
    rb.set(header, 0)
    return rb
  }

  onReadable () {
    const { fd, rb } = this
    const bytes = net.recv2(fd, rb.ptr + this.roff, rb.size - this.roff, 0)
    if (bytes > 0) {
      this.roff += bytes
      let len = rb[1] & 0x7f
      if (len === 126) {
        len = (rb[2] << 8) + rb[3]
        if (len + 4 <= this.roff) {
          this.roff = 0
          this.onmessage(len)
        }
      } else if (len === 127) {
        const l1 = (rb[2] << 24) + (rb[3] << 16) + (rb[4] << 8) + rb[5]
        const l2 = (rb[6] << 24) + (rb[7] << 16) + (rb[8] << 8) + rb[9]
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
    const written = net.send2(fd, buf.ptr + this.woff, towrite, MSG_NOSIGNAL)
    if (written === towrite) {
      this.woff = 0
      return
    }
    if (written === -1) {
      if (system.errno === EAGAIN) {
        this.woff = 0
        loop.modify(fd, () => {
          loop.modify(fd, Loop.Readable, () => this.onReadable())
          this.send(buf, bytes)
        }, Loop.Writable | Loop.EdgeTriggered)
        return
      }
      this.close()
      return
    }
    this.woff += written
    loop.modify(fd, () => {
      loop.modify(fd, Loop.Readable, () => this.onReadable())
      this.send(buf, bytes)
    }, Loop.Writable | Loop.EdgeTriggered)
  }

  connect () {
    const { state, roff, loop, address } = this
    const rb = ptr(new Uint8Array(1024))
    const fd = net.socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
    assert(fd > 0, () => new SystemError('net.socket'))
    let rc = net.connect(fd, address, 16)
    assert((rc > 0 || lo.errno === EINPROGRESS), () => new SystemError('socket'))
    rc = loop.add(fd, () => {
      loop.modify(fd, () => {
        // TODO EAGAIN
        const bytes = net.recv2(fd, rb.ptr + roff, rb.size - roff, 0)
        console.log(`recv ${bytes}`)
        if (bytes > 0) {
          this.roff += bytes
          const nread = pico.parseResponse2(rb.ptr, this.roff, state.ptr)
          if (nread > 0) {
            loop.callbacks[fd] = () => this.onReadable()
            this.roff = 0
            this.onopen()
          }
          return
        }
        this.close()
      }, Loop.Readable)
      const CR = String.fromCharCode(13)
      const hs = `GET / HTTP/1.1${CR}
Upgrade: websocket${CR}
Connection: Upgrade${CR}
Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==${CR}
Host: localhost${CR}
Sec-WebSocket-Version: 13${CR}
${CR}
`
      const handshake = ptr(encoder.encode(hs))
      this.send(handshake)
    }, Loop.Writable | Loop.EdgeTriggered, () => this.onerror())
    assert(rc === 0, () => new SystemError('loop.add'))
    this.fd = fd
  }
}

export { WebSocket }
