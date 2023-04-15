import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { dump } from 'lib/binary.js'
import { Parser } from 'lib/packet.js'

const { assert, args, fs } = spin
const { socket, close, ioctl, ioctl2, read, inet_aton } = net
const { open, fcntl } = fs

const encoder = new TextEncoder()

const SOCK_DGRAM = 2 // for IP frames
const AF_INET = 2

const IFF_TUN	=	0x0001
const IFF_TAP	=	0x0002
const IFF_NO_PI	= 0x1000
const TUNSETIFF = 1074025674

const O_RDWR = 2
const IFF_UP = 1
const SIOCSIFFLAGS = 0x8914
const TUNSETPERSIST = 1074025675
const O_NONBLOCK = 2048
const SIOCSIFADDR = 0x8916
const SIOCSIFNETMASK = 0x891c

function device_ctrl (fd, iff, type = IFF_TAP | IFF_NO_PI, flags = TUNSETIFF) {
  const ifreq = new Uint8Array(40)
  encoder.encodeInto(iff.slice(0, 16), ifreq)
  ifreq[16] = type & 0xff
  ifreq[17] = (type >> 8) & 0xff
  return ioctl(fd, flags, ifreq)
}

function set_persistent (fd, persistent = 1) {
  assert(ioctl2(fd, TUNSETPERSIST, persistent) === 0)
}

function create_device (iff, type = 'tun') {
  const fd = open('/dev/net/tun', O_RDWR, 0)
  assert(fd > 2)
  assert(device_ctrl(fd, iff, (type === 'tun' ? IFF_TUN : IFF_TAP) | IFF_NO_PI) === 0)
  return fd
}

function device_up (iff) {
  const fd = socket(AF_INET, SOCK_DGRAM, 0)
  assert(fd > 2)
  assert(device_ctrl(fd, iff, IFF_UP, SIOCSIFFLAGS) === 0)
  assert(close(fd) === 0)
}

function add_address (iff, address, cidr) {
  const ifreq = new Uint8Array(40)
  const dv = new DataView(ifreq.buffer)
  const fd = socket(AF_INET, SOCK_DGRAM, 0)
  assert(fd > 2)
  ifreq.fill(0)
  encoder.encodeInto(iff.slice(0, 16), ifreq)
  ifreq[16] = AF_INET & 0xff
  ifreq[17] = (AF_INET >> 8) & 0xff
  dv.setUint32(20, inet_aton(address))
  assert(ioctl(fd, SIOCSIFADDR, ifreq) === 0)
  ifreq.fill(0)
  encoder.encodeInto(iff.slice(0, 16), ifreq)
  ifreq[16] = AF_INET & 0xff
  ifreq[17] = (AF_INET >> 8) & 0xff
  let netmask = 0xffffffff - (0xffffffff >>> cidr)
  console.log(netmask)
  dv.setUint32(20, netmask)
  assert(ioctl(fd, SIOCSIFNETMASK, ifreq) === 0)
  assert(close(fd) === 0)
}

const [ iff = 'tap0', address = '10.0.0.1', cidr = 24 ] = args.slice(2)
const fd = create_device(iff)
set_persistent(fd, 0)
add_address(iff, address, cidr)
device_up(iff)
assert(fcntl(fd, O_NONBLOCK, 0))
const eventLoop = new Loop()
const u8 = new Uint8Array(65536)
const parser = new Parser(u8)
assert(!eventLoop.add(fd, () => {
  const bytes = read(fd, u8, 65536)
  if (bytes > 0) {
    const packet = parser.parse(u8.subarray(0, bytes))
    const { header, message } = packet
    console.log(JSON.stringify({ header, message }, null, '  '))
    console.log(dump(u8.subarray(0, bytes)))
    return
  }
  if (bytes < 0) {
    console.log(`${fd} error ${spin.errno}`)
  }
  close(fd)
}))
while (1) {
  spin.runMicroTasks()
  if (eventLoop.poll(-1) <= 0) break
}
net.close(fd)
