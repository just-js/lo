import { net } from 'lib/net.js'
import { dump } from 'lib/binary.js'

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

const MAX_UDP_SIZE = 65507
const decoder = new TextDecoder()
const fd = net.socket(AF_INET, SOCK_DGRAM | SOCK_NONBLOCK, 0)
assert(fd > 2)
const src = net.types.sockaddr_in('127.0.0.1', 4445)
assert(net.bind(fd, src, src.length) === 0, strerror)
const dest = net.types.sockaddr_in('127.0.0.1', 0)
const msghdr = new MsgHdr()
msghdr.address = dest
const iov = new IoVec()
const payload = new Uint8Array(MAX_UDP_SIZE)
iov.payload = payload
msghdr.payload = iov

let recv = 0
let start = 0
let bytes = 0
while (1) {
  const b = net.recvmsg(fd, msghdr.raw, msghdr.size)
  if (b === -1) {
    if (spin.errno === 11) continue
    console.log(strerror())
    break
  }
  if (start === 0) start = Date.now()
  recv++
  bytes += b
  if (recv >= 1000000) {
    const elapsed = Date.now() - start
    const pps = Math.floor(recv / (elapsed / 1000))
    const mbps = Math.floor(((bytes / (elapsed / 1000)) * 8) / 1000000)
    console.log(`pps ${pps} mbps ${mbps}`)
    recv = 0
    start = 0
    bytes = 0
  }
}

// 100k 65507 byte packets per sec
// 1000000 32 bytes packets in 2.9 seconds
// = 345k packets per second