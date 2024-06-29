const net_base = lo.load('net').net

const { utf8EncodeIntoAtOffset, addr, assert } = lo

// todo: use the constants from the bindings
const {
  AF_INET, AF_UNIX, SOCK_STREAM, SOCK_NONBLOCK, EINPROGRESS,
  SOL_SOCKET, SO_REUSEPORT, SOCKADDR_LEN, SOMAXCONN,
  SOCK_CLOEXEC, MSG_NOSIGNAL, PF_PACKET, SOCK_DGRAM, SOCK_RAW,
  ETH_P_ALL, ETH_P_ARP, SIOCGIFHWADDR, SIOCGIFINDEX, SIOCGIFADDR,
  SIOCSIFADDR, IPPROTO_RAW,

  IFF_TUN, IFF_TAP, IFF_NO_PI, IFF_UP
} = net_base
const O_NONBLOCK = 2048
const O_CLOEXEC = 0x80000
const IFF_DOWN = 0
const SIOCSIFFLAGS = 0x8914
const SIOCSIFNETMASK = 0x891c
const TUNSETIFF = 1074025674
const TUNSETPERSIST = 1074025675
const EAGAIN = 11

const constants = {
  AF_INET, SOCK_STREAM, SOCK_NONBLOCK, O_NONBLOCK, SOL_SOCKET, SO_REUSEPORT,
  SOCKADDR_LEN, SOMAXCONN, O_CLOEXEC, SOCK_CLOEXEC, MSG_NOSIGNAL, PF_PACKET,
  SOCK_DGRAM, SOCK_RAW, ETH_P_ALL, ETH_P_ARP, SIOCGIFADDR, SIOCGIFHWADDR,
  SIOCGIFINDEX, IPPROTO_RAW, IFF_TUN, IFF_TAP, IFF_NO_PI, IFF_UP, IFF_DOWN,
  SIOCSIFFLAGS, SIOCSIFADDR, SIOCSIFNETMASK, TUNSETIFF, TUNSETPERSIST, EAGAIN,
  EINPROGRESS
}

/**
 * @param {string} ip
 */
function inet_aton(ip){
  const [b0, b1, b2, b3] = ip.split('.').map(v => (parseInt(v, 10) & 0xff))
  return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3
}

/**
 * @param {string} ip
 * @param {number} port
 */
function sockaddr_in (ip, port) {
  const buf = new ArrayBuffer(16)
  const dv = new DataView(buf)
  dv.setInt16(0, AF_INET, true)
  dv.setUint16(2, port & 0xffff)
  dv.setUint32(4, inet_aton(ip))
  return new Uint8Array(buf)
}

/**
 * @param {number} fd
 * @param {TypedArray} sockaddr
 */
function get_sockname (fd, sockaddr) {
  u32[0] = 16
  assert(net_base.getsockname(fd, sockaddr, u32) === 0)
  return addr(u32)
}

/**
 * @param {string} path
 */
function sockaddr_un (path) {
  const u8 = new Uint8Array(102)
  const dv = new DataView(u8.buffer)
  dv.setInt16(0, AF_UNIX, true)
  utf8EncodeIntoAtOffset(path, u8, 2)
  return u8
}

/**
 * @param {number[]} pipes
 */
const pipe = (pipes, flags = O_CLOEXEC) => {
  const fds = new Uint32Array(2)
  const rc = net_base.pipe2(fds, flags)
  if (rc === 0) {
    pipes[0] = fds[0]
    pipes[1] = fds[1]
  }
  return rc
}

const u32 = new Uint32Array(2)
const on = new Uint32Array([1])
const off = new Uint32Array([0])

const types = {
  sockaddr_in,
  sockaddr_un,
  inet_aton
}
const net = Object.assign({}, net_base, {
  types, on, off, constants,
  get_sockname, inet_aton, pipe
})

export { net }
