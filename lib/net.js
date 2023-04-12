const { net } = spin.load('net')

const AF_INET = 2
const SOCK_STREAM = 1
const SOCK_NONBLOCK = 2048
const O_NONBLOCK = 2048
const SOL_SOCKET = 1
const SO_REUSEPORT = 15
const SOCKADDR_LEN = 16
const SOMAXCONN = 128
const O_CLOEXEC = 0x80000
const SOCK_CLOEXEC = 524288
const MSG_NOSIGNAL = 16384

net.constants = {
  AF_INET, SOCK_STREAM, SOCK_NONBLOCK, O_NONBLOCK, SOL_SOCKET, SO_REUSEPORT,
  SOCKADDR_LEN, SOMAXCONN, O_CLOEXEC, SOCK_CLOEXEC, MSG_NOSIGNAL
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
  return new Uint32Array(buf)
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

const on = new Uint32Array([1])
const off = new Uint32Array([0])

net.on = on
net.off = off

net.types = {
  sockaddr_in
}

export { net }
