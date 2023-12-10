import { net } from 'lib/net.js'
import { system } from 'lib/system.js'

const { socket, close, ioctl, ioctl2, inet_aton } = net
const {
  IFF_TUN, IFF_TAP, IFF_NO_PI, IFF_UP, IFF_DOWN, SIOCSIFFLAGS, SIOCSIFADDR, 
  SIOCSIFNETMASK, TUNSETIFF, TUNSETPERSIST, AF_INET, SOCK_DGRAM, O_NONBLOCK
} = net.constants
const { assert, core } = lo
const { open, fcntl } = core
const { strerror } = system

const O_RDWR = 2

const encoder = new TextEncoder()

// todo: create /dev/net/tun if it doesn't exist

function device_ctrl (fd, iff, type = IFF_TAP | IFF_NO_PI, flags = TUNSETIFF) {
  const ifreq = new Uint8Array(40)
  encoder.encodeInto(iff.slice(0, 16), ifreq)
  ifreq[16] = type & 0xff
  ifreq[17] = (type >> 8) & 0xff
  return ioctl(fd, flags, ifreq)
}

class Device {
  #iff = ''
  #dev = 0
  #fd = 0
  #buf
  #bufSize = 0

  constructor (buf = new Uint8Array(65536)) {
    this.#buf = buf
    this.#bufSize = buf.length
  }

  read () {
    return fs.read(this.#dev, this.#buf, this.#bufSize)
  }

  create (iff, type = 'tun', persistent = false) {
    this.#iff = iff
    const dev = open('/dev/net/tun', O_RDWR, 0)
    assert(dev > 2, strerror)
    assert(device_ctrl(dev, iff, (type === 'tun' ? IFF_TUN : IFF_TAP) | IFF_NO_PI) === 0, strerror)
    this.#dev = dev
    const fd = socket(AF_INET, SOCK_DGRAM, 0)
    assert(fd > 2, strerror)
    this.#fd = fd
    assert(ioctl2(dev, TUNSETPERSIST, persistent ? 1: 0) === 0, strerror)
  }

  nonBlocking () {
    assert(fcntl(this.#dev, O_NONBLOCK, 0), strerror)
  }

  setAddress (addr, cidr) {
    const iff = this.#iff
    const fd = this.#fd
    const ifreq = new Uint8Array(40)
    const dv = new DataView(ifreq.buffer)
    ifreq.fill(0)
    encoder.encodeInto(iff.slice(0, 16), ifreq)
    ifreq[16] = AF_INET & 0xff
    ifreq[17] = (AF_INET >> 8) & 0xff
    dv.setUint32(20, inet_aton(addr))
    assert(ioctl(fd, SIOCSIFADDR, ifreq) === 0, strerror)
    ifreq.fill(0)
    encoder.encodeInto(iff.slice(0, 16), ifreq)
    ifreq[16] = AF_INET & 0xff
    ifreq[17] = (AF_INET >> 8) & 0xff
    let netmask = 0xffffffff - (0xffffffff >>> cidr)
    dv.setUint32(20, netmask)
    assert(ioctl(fd, SIOCSIFNETMASK, ifreq) === 0, strerror)
  }

  up () {
    assert(device_ctrl(this.#fd, this.#iff, IFF_UP, SIOCSIFFLAGS) === 0, strerror)
  }

  down () {
    assert(device_ctrl(this.#fd, this.#iff, IFF_DOWN, SIOCSIFFLAGS) === 0, strerror)
  }

}

export { Device }
