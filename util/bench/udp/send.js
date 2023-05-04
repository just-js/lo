import { net } from 'lib/net.js'
import { dump } from 'lib/binary.js'

const { system } = spin.load('system')

const { assert, getAddress } = spin
const { AF_INET, SOCK_DGRAM, SOCK_NONBLOCK } = net.constants

const eb = new Uint8Array(1024)

const decoder = new TextDecoder()

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
    this.u8 = u8
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
    this.sockaddr = sockaddr
    this.view.setBigUint64(0, BigInt(getAddress(sockaddr)), true)
    this.view.setUint32(8, sockaddr.length, true)
  }

  set payload (iov) {
    this.iov = iov
    this.view.setBigUint64(16, BigInt(getAddress(iov.raw)), true)
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

const fd = net.socket(AF_INET, SOCK_DGRAM | SOCK_NONBLOCK, 0)
assert(fd > 2)
const src = net.types.sockaddr_in('127.0.0.1', 0)
assert(net.bind(fd, src, src.length) === 0, strerror)
const dest = net.types.sockaddr_in('127.0.0.1', 4445)
const msghdr = new MsgHdr()
msghdr.address = dest
const iov = new IoVec()
const payload = new Uint8Array(32)
iov.payload = payload
msghdr.payload = iov
assert(net.sendmsg(fd, msghdr.raw, 0) === payload.length, strerror)

for (let i = 0; i < 10000000; i++) {
  net.sendmsg(fd, msghdr.raw, 0)
}

console.log('done')
