import { net } from 'lib/net.js'
import { system } from 'lib/system.js'

const { socket, close, ioctl, ioctl2, inet_aton } = net
const {
  IFF_TUN, IFF_TAP, IFF_NO_PI, IFF_UP, SIOCSIFFLAGS, SIOCSIFADDR,
  SIOCSIFNETMASK, TUNSETIFF, TUNSETPERSIST, AF_INET, SOCK_DGRAM
} = net.constants
const { assert, core, ptr, load } = lo
const { open, fcntl, read, write } = core
const { F_GETFL, F_SETFL, O_NONBLOCK } = core
const { netlink } = load('netlink')

const { RTM_NEWADDR } = netlink

const O_RDWR = 2
const SIOCGIFFLAGS = 0x8913 // not in the net binding
// extra flags for create(): IFF_VNET_HDR prefixes every packet with a struct virtio_net_hdr (offloads),
// IFF_MULTI_QUEUE allows several fds on one device
const IFF_MULTI_QUEUE = 0x0100
const IFF_VNET_HDR = 0x4000

const encoder = new TextEncoder()
// lo's assert calls a function message with the failed condition, so read errno explicitly
const err = () => system.strerror(lo.errno)

// todo: create /dev/net/tun if it doesn't exist

// struct ifreq: char ifr_name[16], then a union; ifr_flags is a short at offset 16
function ifreq_for (iff) {
  const ifreq = ptr(new Uint8Array(40))
  encoder.encodeInto(iff.slice(0, 15), ifreq) // 15 chars + the NUL
  return ifreq
}

function device_ctrl (fd, iff, type = IFF_TAP | IFF_NO_PI, flags = TUNSETIFF) {
  const ifreq = ifreq_for(iff)
  ifreq[16] = type & 0xff
  ifreq[17] = (type >> 8) & 0xff
  return ioctl(fd, flags, ifreq.ptr)
}

// read-modify-write the interface flags, so up/down don't clear the others
function set_flags (fd, iff, set, clear) {
  const ifreq = ifreq_for(iff)
  if (ioctl(fd, SIOCGIFFLAGS, ifreq.ptr) !== 0) return -1
  const flags = ((ifreq[16] | (ifreq[17] << 8)) | set) & ~clear
  ifreq[16] = flags & 0xff
  ifreq[17] = (flags >> 8) & 0xff
  return ioctl(fd, SIOCSIFFLAGS, ifreq.ptr)
}

class Device {
  #iff = ''
  #dev = 0
  #fd = 0
  #buf
  #bufSize = 0

  constructor (buf = new Uint8Array(65536)) {
    this.#buf = buf.ptr ? buf : ptr(buf)
    this.#bufSize = buf.length
  }

  // one packet per call (into the constructor's buffer); returns its length, or -1 (EAGAIN when non-blocking)
  read () {
    return read(this.#dev, this.#buf.ptr, this.#bufSize)
  }

  // one packet per call; buf must be ptr()-wrapped
  write (buf, len = buf.length) {
    return write(this.#dev, buf.ptr, len)
  }

  // flags: extra IFF_* bits for TUNSETIFF, e.g. Device.IFF_VNET_HDR
  create (iff, type = 'tun', persistent = false, flags = 0) {
    this.#iff = iff
    const dev = open('/dev/net/tun', O_RDWR, 0)
    assert(dev > 2, err)
    if (device_ctrl(dev, iff, (type === 'tun' ? IFF_TUN : IFF_TAP) | IFF_NO_PI | flags) !== 0) {
      const msg = err()
      close(dev)
      throw new Error(`TUNSETIFF ${iff}: ${msg}`)
    }
    this.#dev = dev
    const fd = socket(AF_INET, SOCK_DGRAM, 0)
    assert(fd > 2, err)
    this.#fd = fd
    assert(ioctl2(dev, TUNSETPERSIST, persistent ? 1: 0) === 0, err)
  }

  nonBlocking () {
    const flags = fcntl(this.#dev, F_GETFL, 0)
    assert(flags >= 0, err)
    assert(fcntl(this.#dev, F_SETFL, flags | O_NONBLOCK) === 0, err)
  }

  // returns 0 or -errno (e.g. -EEXIST if the address is already set); not asserted, callers may re-run on a
  // device that already has it
  setAddress (addr, cidr) {
    return netlink.set_address(RTM_NEWADDR, this.#iff, addr, cidr)
  }

  setAddress2 (addr, cidr) {
    const iff = this.#iff
    const fd = this.#fd
    const ifreq = ptr(new Uint8Array(40))
    const dv = new DataView(ifreq.buffer)
    ifreq.fill(0)
    encoder.encodeInto(iff.slice(0, 15), ifreq)
    ifreq[16] = AF_INET & 0xff
    ifreq[17] = (AF_INET >> 8) & 0xff
    dv.setUint32(20, inet_aton(addr))
    assert(ioctl(fd, SIOCSIFADDR, ifreq.ptr) === 0, err)
    ifreq.fill(0)
    encoder.encodeInto(iff.slice(0, 15), ifreq)
    ifreq[16] = AF_INET & 0xff
    ifreq[17] = (AF_INET >> 8) & 0xff
    let netmask = 0xffffffff - (0xffffffff >>> cidr)
    dv.setUint32(20, netmask)
    assert(ioctl(fd, SIOCSIFNETMASK, ifreq.ptr) === 0, err)
  }

  up () {
    assert(set_flags(this.#fd, this.#iff, IFF_UP, 0) === 0, err)
  }

  down () {
    assert(set_flags(this.#fd, this.#iff, 0, IFF_UP) === 0, err)
  }

  close () {
    close(this.#fd)
    close(this.#dev)
  }

  get fd () { return this.#dev }
  get name () { return this.#iff }
  get buffer () { return this.#buf }

  static IFF_VNET_HDR = IFF_VNET_HDR
  static IFF_MULTI_QUEUE = IFF_MULTI_QUEUE
}

export { Device }
