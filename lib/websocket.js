import { Loop } from 'lib/loop.js'
import { net } from 'lib/net.js'
import { pico } from 'lib/pico.js'
import { system } from 'lib/system.js'
import { dump } from 'lib/binary.js'

const { ptr } = spin
const { SystemError } = system
const { AF_INET, SOCK_STREAM, SOCK_NONBLOCK, MSG_NOSIGNAL } = net.constants
const { EINPROGRESS, EAGAIN } = system.constants

const encoder = new TextEncoder()
const decoder = new TextDecoder()

class WebSocket {
  fd = 0
  state = new Uint8Array(32 + (32 * 14))
  loop = undefined
  roff = 0

  constructor (loop, port = 3000, address = '127.0.0.1', max = 64 * 1024) {
    this.sockaddr = net.types.sockaddr_in(address, port)
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
    this.roff = this.fd = 0
    this.loop = undefined
    this.onclose()
  }

  static createMessage (size, mask = 1) {
    let header
    let maskbit = 0
    if (mask === 1) {
      maskbit = 128
    }
    if (size < 126) {
      header = new Uint8Array([0x82, size + maskbit])
      size += 2
    } else if (size < 65536) {
      header = new Uint8Array([0x82, 126 + (mask << 4), size >>> 8, size & 0xff])
      size += 4
    } else {
      header = new Uint8Array(14)
      header[0] = 0x82
      header[1] = 127 + (mask << 4)
      let l = size
      for (let i = 9; i > 1; i--) {
        header[i] = l & 0xff
        l >>>= 8
      }
      size += 10
    }
    if (mask) size += 4
    const rb = ptr(new Uint8Array(size))
    rb.set(header, 0)
    rb.off = header.length
    if (mask) {
      rb[2] = 1
      rb[3] = 2
      rb[4] = 3
      rb[5] = 4
    }
    return rb
  }

  onReadable () {
    const { fd, rb, roff } = this
    const bytes = net.recv2(fd, rb.ptr + roff, rb.length - roff, 0)
    if (bytes > 0) {
      let len = rb[1] & 0x7f
      if (len === 126) {
        len = (rb[2] << 8) + rb[3]
        if (len + 4 <= bytes) {
          this.onmessage(len)
        } else {
          console.log('bad len')
        }
      } else if (len === 127) {
        const l1 = (rb[2] << 24) + (rb[3] << 16) + (rb[4] << 8) + rb[5]
        const l2 = (rb[6] << 24) + (rb[7] << 16) + (rb[8] << 8) + rb[9]
        len = (l1 << 32) + l2
        if (len + 10 <= bytes) {
          this.onmessage(len)
        }
      } else if (len + 2 <= bytes) {
        this.onmessage(len)
      }
      return
    }
    if ((bytes < 0 && spin.errno === EAGAIN) || spin.errno === EINPROGRESS) return
    console.log(system.strerror(spin.errno))
    console.log(bytes)
    this.close()
  }

  send (buf) {
    const { fd, loop } = this
    const towrite = buf.length
    const written = net.send2(fd, buf.ptr, towrite, 0)
    if (written === towrite) {
      //console.log(`send ${written}`)
      //console.log(dump(buf.subarray(0, 256)))
      return
    }
    console.log(written)
    if (written === -1) {
      if (system.errno === EAGAIN) {
        loop.modify(fd, Loop.Writable | Loop.EdgeTriggered, () => {
          loop.modify(fd, Loop.Readable, () => this.onReadable())
          this.send(buf)
        })
        return
      }
      this.close()
      return
    }
    loop.modify(fd, Loop.Writable | Loop.EdgeTriggered, () => {
      loop.modify(fd, Loop.Readable, () => this.onReadable())
      this.send(buf.slice(written))
    })
  }

  connect () {
    const { state, roff, loop, sockaddr } = this
    const rb = new Uint8Array(1024)
    const fd = net.socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
    spin.assert(fd > 0, 'net.socket', SystemError)
    let rc = net.connect(fd, sockaddr, 16)
    spin.assert((rc > 0 || spin.errno === EINPROGRESS), 'socket', SystemError)
    rc = loop.add(fd, () => {
      loop.modify(fd, Loop.Readable, () => {
        //console.log('onReadableInit')
        // TODO EAGAIN
        const bytes = net.recv(fd, rb.subarray(roff), rb.length - roff, 0)
        if (bytes > 0) {
          this.roff += bytes
          const nread = pico.parseResponse(rb, this.roff, state)
          if (nread > 0) {
            //console.log(dump(rb.subarray(0, nread)))
            //loop.modify(fd, Loop.Readable, () => this.onReadable())
            loop.callbacks[fd] = () => this.onReadable()
            this.roff = 0
            this.onopen()
          }
          return
        }
        console.log(bytes)
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
      const handshake = ptr(encoder.encode(hs))
      this.send(handshake)
    }, Loop.Writable | Loop.EdgeTriggered, () => this.onerror())
    spin.assert(rc === 0, 'loop.add', SystemError)
    this.fd = fd
  }
}

export { WebSocket }
