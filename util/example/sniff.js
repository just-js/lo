import { Library } from 'lib/ffi.js'
import { dump } from 'lib/binary.js'
import { colors } from 'lib/ansi.js'

import { Parser, protocols, toMAC, htons16, tcpDump, udpDump } from 'lib/packet.js'

const { assert, utf8EncodeInto, args, ptr } = spin
const { AG, AD, AY } = colors

const PF_PACKET = 17
const SOCK_RAW = 3
const ETH_P_ALL = 3
const SIOCGIFHWADDR = 0x8927
const SIOCGIFINDEX = 0x8933

function onPacket (packet, u8) {
  const { offset, bytes, frame, header } = packet
  if (!(frame && header)) return
  if (frame.protocol === 'IPv4' && header.protocol === protocols.TCP) {
    console.log(`\n${tcpDump(packet)}`)
    if (bytes > offset) console.log(dump(u8.slice(offset, bytes)), false)
  } else if (frame.protocol === 'IPv4' && header.protocol === protocols.UDP) {
    console.log(`\n${udpDump(packet)}`)
    if (bytes > offset) console.log(dump(u8.slice(offset, bytes)), false)
  }
}

const {
  socket, bind, ioctl, recv, sizeof_ifreq, sizeof_sockaddr_ll, close
} = (new Library()).open().compile(`
#include <net/if.h>
#include <linux/if_packet.h>
int sizeof_ifreq () {
  return sizeof(struct ifreq);
}
int sizeof_sockaddr_ll () {
  return sizeof(struct sockaddr_ll);
}
`).bind({
  socket: { parameters: ['i32', 'i32', 'i32'], result: 'i32' },
  bind: { parameters: ['i32', 'pointer', 'i32'], result: 'i32' },
  ioctl: { parameters: ['i32', 'i32', 'pointer'], result: 'i32' },
  recv: { parameters: ['i32', 'pointer', 'u32', 'i32'], result: 'i32' },
  sizeof_ifreq: { parameters: [], result: 'i32', internal: true },
  sizeof_sockaddr_ll: { parameters: [], result: 'i32', internal: true },
  close: { parameters: ['i32'], result: 'i32' }
})

const iff = args[2] || 'lo'

const ifreq = ptr(new Uint8Array(sizeof_ifreq()))
const sockaddr = ptr(new Uint8Array(sizeof_sockaddr_ll()))

const fd = socket(PF_PACKET, SOCK_RAW, htons16(ETH_P_ALL))
assert(fd > 2)
utf8EncodeInto(ifreq.ptr, iff)
assert(ioctl(fd, SIOCGIFHWADDR, ifreq.ptr) === 0)
const mac = toMAC(ifreq.subarray(18, 24))
assert(ioctl(fd, SIOCGIFINDEX, ifreq.ptr) === 0)
const index = ifreq[16] + (ifreq[17] << 8)
console.log(`listening to ${AG}interface${AD} ${iff} ${AY}mac${AD} ${mac} ${AY}index${AD} ${index}`)
sockaddr[0] = PF_PACKET & 0xff // type
sockaddr[1] = (PF_PACKET >> 8) & 0xff // family
sockaddr[2] = htons16(ETH_P_ALL) & 0xff
sockaddr[3] = (htons16(ETH_P_ALL) >> 8) & 0xff // protocol
sockaddr[4] = index & 0xff
sockaddr[5] = (index >> 8) & 0xff // index
assert(bind(fd, sockaddr.ptr, sockaddr.length) === 0)

const rbuf = ptr(new Uint8Array(65536))
const { parse } = new Parser(rbuf)

let bytes = recv(fd, rbuf.ptr, rbuf.size, 0)

while (bytes > 0) {
  onPacket(parse(bytes, true), rbuf)
  bytes = recv(fd, rbuf.ptr, rbuf.size, 0)
}

close(fd)
