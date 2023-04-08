import { dump } from 'lib/binary.js'
import { Library } from 'lib/ffi.js'
import { toMAC, htons16 } from 'lib/packet.js'

const { assert, utf8EncodeInto, args } = spin
const { AG, AD, AY } = spin.colors

const PF_PACKET = 17
const SOCK_DGRAM = 2 // for IP frames
const SOCK_RAW = 3 // for Ethernet frames
const ETH_P_ALL = 3
const ETH_P_ARP = 0x0806
const SIOCGIFHWADDR = 0x8927
const SIOCGIFINDEX = 0x8933
const SIOCGIFADDR = 0x8915
const IPPROTO_RAW = 255

const {
  socket, bind, ioctl, recv, sizeof_ifreq, sizeof_sockaddr_ll, close,
  sizeof_ether_arp, sizeof_in_addr_t, sendto
} = (new Library()).open().compile(`
#include <net/if.h>
#include <linux/if_packet.h>
#include <netinet/if_ether.h>
#include <netinet/in.h>

int sizeof_ifreq () {
  return sizeof(struct ifreq);
}
int sizeof_sockaddr_ll () {
  return sizeof(struct sockaddr_ll);
}
int sizeof_ether_arp () {
  return sizeof(struct	ether_arp);
}
int sizeof_in_addr_t () {
  return sizeof(in_addr_t);
}
`).bind({
  socket: { parameters: ['i32', 'i32', 'i32'], result: 'i32' },
  bind: { parameters: ['i32', 'buffer', 'i32'], result: 'i32' },
  ioctl: { parameters: ['i32', 'i32', 'buffer'], result: 'i32' },
  recv: { parameters: ['i32', 'buffer', 'u32', 'i32'], result: 'i32' },
  sendto: { parameters: ['i32', 'buffer', 'u32', 'i32', 'buffer', 'i32'], result: 'i32' },
  sizeof_ifreq: { parameters: [], result: 'i32', internal: true },
  sizeof_sockaddr_ll: { parameters: [], result: 'i32', internal: true },
  sizeof_ether_arp: { parameters: [], result: 'i32', internal: true },
  sizeof_in_addr_t: { parameters: [], result: 'i32', internal: true },
  close: { parameters: ['i32'], result: 'i32' }
})

const iff = args[2] || 'lo'

const type = htons16(ETH_P_ARP)

const ifreq = new Uint8Array(sizeof_ifreq())
const fd = socket(PF_PACKET, SOCK_DGRAM, htons16(ETH_P_ALL))
assert(fd > 2)
utf8EncodeInto(iff, ifreq)
assert(ioctl(fd, SIOCGIFHWADDR, ifreq) === 0)
const mac = toMAC(ifreq.subarray(18, 24))
const macb = ifreq.slice(18, 24)
assert(ioctl(fd, SIOCGIFINDEX, ifreq) === 0)
const index = ifreq[16] + (ifreq[17] << 8)
assert(ioctl(fd, SIOCGIFADDR, ifreq) === 0)
const ip = ifreq.subarray(20, 24).join('.')
const ipb = ifreq.slice(20, 24)
console.log(`${AG}interface${AD} ${iff} ${AY}mac${AD} ${mac} ${AY}index${AD} ${index} ${AY}ip${AD} ${ip}`)
const ETHER_ADDR_LEN = 6
const ARPHRD_ETHER = 1
const ETH_P_IP = 0x0800
const ARPOP_REQUEST = 1

const sockaddr = new Uint8Array(sizeof_sockaddr_ll())

sockaddr[0] = PF_PACKET & 0xff // type
sockaddr[1] = (PF_PACKET >> 8) & 0xff // family

sockaddr[2] = type & 0xff
sockaddr[3] = (type >> 8) & 0xff // protocol

sockaddr[4] = index & 0xff
sockaddr[5] = (index >> 8) & 0xff // index
// 2 + 2 + 1 + 1 + 8
// broadcast address
sockaddr[12] = sockaddr[13] = sockaddr[14] = sockaddr[15] = sockaddr[16] = sockaddr[17] = 0xff

const ether_arp = new Uint8Array(sizeof_ether_arp())

ether_arp[0] = ARPHRD_ETHER & 0xff // hardware address format
ether_arp[1] = (ARPHRD_ETHER >> 8) & 0xff

ether_arp[2] = ETH_P_IP & 0xff // protocol address format
ether_arp[3] = (ETH_P_IP >> 8) & 0xff

ether_arp[4] = ETHER_ADDR_LEN // length of hardware address
ether_arp[5] = sizeof_in_addr_t() // length of protocol address

ether_arp[6] = ARPOP_REQUEST & 0xff // protocol address format
ether_arp[7] = (ARPOP_REQUEST >> 8) & 0xff

ether_arp.set(macb, 8) // set sender hw address/mac
ether_arp.set(ipb, 14) // set sender protocol address

// populate target ip address for which we need a mac address
ipb[0] = 192
ipb[1] = 168
ipb[2] = 1
ipb[3] = 3
ether_arp.set(ipb, 24) // set target protocol address

console.log(dump(ether_arp))
console.log(dump(sockaddr))

assert(sendto(fd, ether_arp, ether_arp.length, 0, sockaddr, sockaddr.length) === ether_arp.length)

close(fd)

