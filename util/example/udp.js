import { net } from 'lib/net.js'

const { system } = spin.load('system')

const { assert, getAddress } = spin
const { AF_INET, SOCK_DGRAM, SOCK_NONBLOCK } = net.constants

const eb = new Uint8Array(1024)

function strerror (errnum = spin.errno) {
  const rc = system.strerror_r(errnum, eb, 1024)
  if (rc !== 0) return ''
  return decoder.decode(eb)
}

class IoVec {
  constructor () {
    this.size = 16
    this.raw = new Uint8Array(16)
    this.view = new DataView(this.raw.buffer)
  }

  set payload (u8) {
    this.view.setBigUint64(0, BigInt(getAddress(u8)), true)
    this.view.setUint32(8, u8.length, true)
  }
}

class MsgHdr {
  constructor () {
    this.raw = new Uint8Array(56)
    this.view = new DataView(this.raw.buffer)
    this.size = 56
  }

  set address (sockaddr) {
    this.view.setBigUint64(0, BigInt(getAddress(sockaddr)), true)
    this.view.setUint32(8, sockaddr.length, true)
  }

  set payload (u8) {
    this.view.setBigUint64(16, BigInt(getAddress(u8)), true)
    this.view.setUint32(24, 1, true)
  }

  set control (u8) {
    this.view.setBigUint64(32, BigInt(getAddress(u8)), true)
    this.view.setUint32(40, u8.length, true)
  }

  set flags (flags) {
    this.view.setUint32(48, flags, true)
  }
}

class UDPSocket {
  bind (address, port) {

  }

  create ()
}

const MAX_UDP_SIZE = 65507
const decoder = new TextDecoder()
const fd = net.socket(AF_INET, SOCK_DGRAM | SOCK_NONBLOCK, 0)
assert(fd > 2)
const src = net.types.sockaddr_in('127.0.0.1', 4445)
assert(net.bind(fd, src, src.length) === 0, strerror)
const dest = net.types.sockaddr_in('127.0.0.1', 4444)
const msghdr = new MsgHdr()
msghdr.address = dest
const iov = new IoVec()
const payload = new Uint8Array(MAX_UDP_SIZE)
iov.payload = payload
msghdr.payload = iov.raw

while (1) {
  if (net.recvmsg(fd, msghdr.raw, msghdr.size) === -1) {
    if (spin.errno === 11) continue
    console.log(strerror())
    break
  }
}

