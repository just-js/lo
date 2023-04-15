import { dump } from 'lib/binary.js'
import {
  Parser, protocols, toMAC, htons16, tcpDump, udpDump, b2ipv4
} from 'lib/packet.js'
import { net } from 'lib/net.js'

const { bind, socket, close, ioctl, recv, read } = net
const { assert, utf8EncodeInto, args } = spin
const { AG, AD, AY, AM } = spin.colors
const PF_PACKET = 17
const SOCK_RAW = 3
const ETH_P_ALL = 3
const SIOCGIFHWADDR = 0x8927
const SOL_SOCKET = 1
const SIOCGIFINDEX = 0x8933
const SIOCGIFADDR = 0x8915
const SO_BINDTODEVICE = 25
const iff = args[2] || 'lo'
const ifreq = new Uint8Array(40)
const type = htons16(ETH_P_ALL)
const fd = socket(PF_PACKET, SOCK_RAW, type)
assert(fd > 2)
utf8EncodeInto(iff, ifreq)
assert(ioctl(fd, SIOCGIFHWADDR, ifreq) === 0)
const mac = toMAC(ifreq.subarray(18, 24))
assert(ioctl(fd, SIOCGIFINDEX, ifreq) === 0)
const index = ifreq[16] + (ifreq[17] << 8)
assert(ioctl(fd, SIOCGIFADDR, ifreq) === 0)
const ip = ifreq.subarray(20, 24).join('.')
console.log(`${AG}interface${AD} ${iff} ${AY}mac${AD} ${mac} ${AY}index${AD} ${index} ${AY}ip${AD} ${ip}`)
const sockaddr = new Uint8Array(20)
sockaddr[0] = PF_PACKET & 0xff
sockaddr[1] = (PF_PACKET >> 8) & 0xff // family
sockaddr[2] = type & 0xff
sockaddr[3] = (type >> 8) & 0xff // protocol
sockaddr[4] = index & 0xff
sockaddr[5] = (index >> 8) & 0xff // index
assert(bind(fd, sockaddr, sockaddr.length) === 0)
const BUFSIZE = 65536
const u8 = new Uint8Array(BUFSIZE)
const { parse } = new Parser(u8)
let bytes = recv(fd, u8, BUFSIZE, 0)
while (bytes > 0) {
  const packet = parse(bytes, true)
  const { offset, frame, header } = packet
  if (frame.protocol === 'IPv4' && header.protocol === protocols.TCP) {
    const [source, dest] = [b2ipv4(header.source), b2ipv4(header.dest)] // convert source and dest ip to human-readable
    if (source === ip || dest === ip) {
      console.log(`\n${tcpDump(packet)}`)
      if (bytes > offset) console.log(dump(u8.slice(offset, bytes)), false)
    } else {
      console.log(`${AM}Eth  ${AD}: ${AM}${toMAC(frame.source)}${AD} -> ${AM}${toMAC(frame.dest)}${AD}`)
      console.log(dump(u8.slice(0, bytes)), false)
    }
  } else {
    console.log(`${AM}Eth  ${AD}: ${AM}${toMAC(frame.source)}${AD} -> ${AM}${toMAC(frame.dest)}${AD}`)
    console.log(dump(u8.slice(0, bytes)), false)
  }
  bytes = recv(fd, u8, BUFSIZE, 0)
}

close(fd)
