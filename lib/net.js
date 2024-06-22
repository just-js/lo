const { net } = lo.load('net')

const { utf8EncodeIntoAtOffset, addr, assert } = lo

// todo: use the constants from the bindings
const { AF_INET, AF_UNIX, SOCK_STREAM, SOCK_NONBLOCK, EINPROGRESS } = net
//const SOCK_STREAM = 1
//const SOCK_NONBLOCK = 2048
const O_NONBLOCK = 2048
const SOL_SOCKET = 1
const SO_REUSEPORT = 15
const SOCKADDR_LEN = 16
const SOMAXCONN = 128
const O_CLOEXEC = 0x80000
const SOCK_CLOEXEC = 524288
const MSG_NOSIGNAL = 16384
const PF_PACKET = 17
const SOCK_DGRAM = 2 // for IP frames
const SOCK_RAW = 3 // for Ethernet frames
const ETH_P_ALL = 3
const ETH_P_ARP = 0x0806
const SIOCGIFHWADDR = 0x8927
const SIOCGIFINDEX = 0x8933
const SIOCGIFADDR = 0x8915
const SIOCSIFADDR = 0x8916
const IPPROTO_RAW = 255

const IFF_TUN	=	0x0001
const IFF_TAP	=	0x0002
const IFF_NO_PI	= 0x1000
const IFF_UP = 1
const IFF_DOWN = 0
const SIOCSIFFLAGS = 0x8914
const SIOCSIFNETMASK = 0x891c
const TUNSETIFF = 1074025674
const TUNSETPERSIST = 1074025675
const EAGAIN = 11

net.constants = {
  AF_INET, SOCK_STREAM, SOCK_NONBLOCK, O_NONBLOCK, SOL_SOCKET, SO_REUSEPORT,
  SOCKADDR_LEN, SOMAXCONN, O_CLOEXEC, SOCK_CLOEXEC, MSG_NOSIGNAL, PF_PACKET,
  SOCK_DGRAM, SOCK_RAW, ETH_P_ALL, ETH_P_ARP, SIOCGIFADDR, SIOCGIFHWADDR, 
  SIOCGIFINDEX, IPPROTO_RAW, IFF_TUN, IFF_TAP, IFF_NO_PI, IFF_UP, IFF_DOWN,
  SIOCSIFFLAGS, SIOCSIFADDR, SIOCSIFNETMASK, TUNSETIFF, TUNSETPERSIST, EAGAIN,
  EINPROGRESS
}

function inet_aton(ip){
  const [b0, b1, b2, b3] = ip.split('.').map(v => (parseInt(v, 10) & 0xff))
  return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3
}

function sockaddr_in (ip, port) {
  const buf = new ArrayBuffer(16)
  const dv = new DataView(buf)
  dv.setInt16(0, AF_INET, true)
  dv.setUint16(2, port & 0xffff)
  dv.setUint32(4, inet_aton(ip))
  return new Uint8Array(buf)
}

function get_sockname (fd, sockaddr) {
  u32[0] = 16
  assert(net.getsockname(fd, sockaddr, u32) === 0)
  return addr(u32)
}

function sockaddr_un (path) {
  const u8 = new Uint8Array(102)
  const dv = new DataView(u8.buffer)
  dv.setInt16(0, AF_UNIX, true)
  utf8EncodeIntoAtOffset(path, u8, 2)
  return u8
}

net.pipe = (pipes, flags = O_CLOEXEC) => {
  const fds = new Uint32Array(2)
  const rc = net.pipe2(fds, flags)
  if (rc === 0) {
    pipes[0] = fds[0]
    pipes[1] = fds[1]
  }
  return rc
}

net.inet_aton = inet_aton

const u32 = new Uint32Array(2)
const on = new Uint32Array([1])
const off = new Uint32Array([0])

net.on = on
net.off = off

net.get_sockname = get_sockname

net.types = {
  sockaddr_in,
  sockaddr_un,
  inet_aton
}

export { net }
