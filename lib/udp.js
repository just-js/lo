import { net } from 'lib/net.js'
//import { system } from 'lib/system.js'

//const { strerror } = system
const { assert, ptr, core } = lo
const { 
  sendmsg, recvmsg, connect, listen,
  AF_INET, SOCK_DGRAM, SOCK_NONBLOCK, SOCKADDR_LEN, EINPROGRESS
} = net
const { socket, bind, close } = net
const { sockaddr_in } = net.types

const Readable = core.os === 'mac' ? -1 : 1

class IoVec {
  constructor () {
    this.size = 16
    this.raw = ptr(new Uint8Array(16))
    this.view = new DataView(this.raw.buffer)
  }

  set payload (u8) {
    if (u8 === this.u8) return
    this.u8 = u8.ptr ? u8 : ptr(u8)
    this.view.setBigUint64(0, BigInt(u8.ptr), true)
    this.view.setUint32(8, u8.length, true)
  }

  set length (len) {
    this.view.setUint32(8, len, true)
  }
}

class MsgHdr {
  constructor () {
    this.size = 56
    this.raw = new Uint8Array(56)
    this.view = new DataView(this.raw.buffer)
  }

  set address (sockaddr) {
    if (sockaddr === this.sockaddr) return
    this.sockaddr = sockaddr.ptr ? sockaddr : ptr(sockaddr)
    this.view.setBigUint64(0, BigInt(sockaddr.ptr), true)
    this.view.setUint32(8, sockaddr.length, true)
  }

  set payload (iov) {
    if (iov === this.iov) return
    this.iov = iov
    this.view.setBigUint64(16, BigInt(iov.raw.ptr), true)
    this.view.setUint32(24, 1, true)
  }
/*
  set control (u8) {
    this.view.setBigUint64(32, BigInt(ptr(u8)), true)
    this.view.setUint32(40, u8.length, true)
  }
*/
  set flags (flags) {
    this.view.setUint32(48, flags, true)
  }
}

class Node {
  loop = undefined
  fd = -1
  msghdr = new MsgHdr()
  iov = new IoVec()
  #port = 0
  address = '127.0.0.1'
  peer_address = undefined

  constructor (loop) {
    if (loop) this.loop = loop
  }

  bind (address, on_readable, port = 0, on_error = noop) {
    assert(this.fd === -1)
    const { loop } = this
    let flags = SOCK_DGRAM
    if (loop) flags |= SOCK_NONBLOCK
    const fd = socket(AF_INET, flags, 0)
    assert(fd > 2)
    const src = sockaddr_in(address, port)
    //assert(bind(fd, src, src.length) === 0, strerror)
    assert(bind(fd, src, src.length) === 0)
    if (loop) assert(loop.add(fd, on_readable, Readable, on_error) === 0)
    this.fd = fd
    this.#port = port
    this.address = address
    this.msghdr.payload = this.iov
    if (!loop) lo.nextTick(on_readable)
  }

  connect (address, port) {
    return connect(this.fd, sockaddr_in(address, port), SOCKADDR_LEN)
  }

  listen () {
    assert(listen(this.fd, 128) === 0)
  }

  recv (u8, flags = 0) {
    this.iov.payload = u8
    this.iov.length = u8.length
    return recvmsg(this.fd, this.msghdr.raw, flags)
  }

  send (u8, size = u8.length, flags = 0) {
    this.iov.payload = u8
    this.iov.length = size
    return sendmsg(this.fd, this.msghdr.raw, flags)
  }

  sendto (u8, addr, size = u8.length, flags = 0) {
    this.iov.payload = u8
    this.iov.length = size
    return sendmsg(this.fd, addr.raw, flags)
  }

  peer (address, port) {
    this.peer_address = sockaddr_in(address, port)
    this.msghdr.address = this.peer_address
  }

  close () {
    if (this.loop) this.loop.remove(this.fd)
    close(this.fd)
    this.fd = -1
  }

  get port () {
    if (this.#port > 0) return this.#port
    const src = sockaddr_in(this.address, this.#port)
    net.get_sockname(this.fd, src)
    this.#port = (new DataView(src.buffer)).getUint16(2, true)
    return this.#port    
  }
}


const MAX_UDP_SIZE = 65507
Node.MAX_UDP_SIZE = MAX_UDP_SIZE
const noop = () => {}

export { IoVec, MsgHdr, Node }
