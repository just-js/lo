import { Library } from 'lib/ffi.js'
import { dump } from 'lib/binary.js'
import { Parser, protocols, toMAC, htons16, tcpDump, udpDump } from 'lib/packet.js'

const { assert, utf8EncodeInto, args } = spin
const { AG, AD, AY } = spin.colors

const PF_PACKET = 17
const SOCK_RAW = 3
const ETH_P_ALL = 3
const ETH_P_ARP = 0x0806
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
  } else {
    console.log(dump(u8.slice(offset, bytes)), false)
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
  bind: { parameters: ['i32', 'buffer', 'i32'], result: 'i32' },
  ioctl: { parameters: ['i32', 'i32', 'buffer'], result: 'i32' },
  recv: { parameters: ['i32', 'buffer', 'u32', 'i32'], result: 'i32' },
  sizeof_ifreq: { parameters: [], result: 'i32', internal: true },
  sizeof_sockaddr_ll: { parameters: [], result: 'i32', internal: true },
  close: { parameters: ['i32'], result: 'i32' }
})

const iff = args[2] || 'lo'

const ifreq = new Uint8Array(sizeof_ifreq())
const sockaddr = new Uint8Array(sizeof_sockaddr_ll())

const type = htons16(ETH_P_ALL)
const fd = socket(PF_PACKET, SOCK_RAW, type)
assert(fd > 2)
utf8EncodeInto(iff, ifreq)
assert(ioctl(fd, SIOCGIFHWADDR, ifreq) === 0)
const mac = toMAC(ifreq.subarray(18, 24))
assert(ioctl(fd, SIOCGIFINDEX, ifreq) === 0)
const index = ifreq[16] + (ifreq[17] << 8)
console.log(`listening to ${AG}interface${AD} ${iff} ${AY}mac${AD} ${mac} ${AY}index${AD} ${index}`)
sockaddr[0] = PF_PACKET & 0xff // type
sockaddr[1] = (PF_PACKET >> 8) & 0xff // family
sockaddr[2] = type & 0xff
sockaddr[3] = (type >> 8) & 0xff // protocol
sockaddr[4] = index & 0xff
sockaddr[5] = (index >> 8) & 0xff // index
assert(bind(fd, sockaddr, sockaddr.length) === 0)

const BUFSIZE = 65536
const rbuf = new Uint8Array(BUFSIZE)
const { parse } = new Parser(rbuf)

let bytes = recv(fd, rbuf, BUFSIZE, 0)
while (bytes > 0) {
  console.log(bytes)
  onPacket(parse(bytes, true), rbuf)
  bytes = recv(fd, rbuf, BUFSIZE, 0)
}

close(fd)
