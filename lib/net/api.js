const api = {
  socket: {
    parameters: ['i32', 'i32', 'i32'],
    result: 'i32'
  },
  setsockopt: {
    parameters: ['i32', 'i32', 'i32', 'buffer', 'i32'],
    result: 'i32'
  },
  bind: {
    parameters: ['i32', 'buffer', 'i32'],
    pointers: [, 'const struct sockaddr*'],
    result: 'i32'
  },
  connect: {
    parameters: ['i32', 'buffer', 'i32'],
    pointers: [, 'const sockaddr*'],
    result: 'i32'
  },
  listen: {
    parameters: ['i32', 'i32'],
    result: 'i32'
  },
  close: {
    parameters: ['i32'],
    result: 'i32'
  },
  accept: {
    parameters: ['i32', 'pointer', 'pointer'],
    pointers: [, 'sockaddr*', 'socklen_t*'],
    result: 'i32'
  },
  accept4: {
    parameters: ['i32', 'pointer', 'pointer', 'i32'],
    pointers: [, 'sockaddr*', 'socklen_t*'],
    result: 'i32',
    platform: ['linux']
  },
  send: {
    parameters: ['i32', 'buffer', 'u32', 'i32'],
    result: 'i32'
  },
  send_string: {
    parameters: ['i32', 'string', 'i32', 'u32'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }, 0],
    result: 'i32',
    name: 'send'
  },
  send2: {
    parameters: ['i32', 'pointer', 'i32', 'u32'],
    result: 'i32',
    name: 'send'
  },
  sendto: {
    parameters: ['i32', 'buffer', 'u32', 'i32', 'buffer', 'u32'],
    pointers: [,,,, 'const struct sockaddr*'],
    result: 'i32'
  },
  recv: {
    parameters: ['i32', 'buffer', 'u32', 'i32'],
    result: 'i32'
  },
  recv2: {
    parameters: ['i32', 'pointer', 'u32', 'i32'],
    result: 'i32',
    name: 'recv'
  },
  recvfrom: {
    parameters: ['i32', 'buffer', 'u32', 'i32', 'buffer', 'buffer'],
    pointers: [, , , , 'struct sockaddr*', 'socklen_t*'],
    result: 'i32'
  },
  sendmsg: {
    parameters: ['i32', 'buffer', 'i32'],
    pointers: [, 'const msghdr*'],
    result: 'i32'
  },
  sendmmsg: {
    parameters: ['i32', 'buffer', 'i32', 'i32'],
    pointers: [, 'struct mmsghdr*'],
    result: 'i32',
    platform: ['linux']
  },
  recvmsg: {
    parameters: ['i32', 'buffer', 'u32'],
    pointers: [, 'msghdr*'],
    result: 'i32'
  },
  recvmmsg: {
    parameters: ['i32', 'buffer', 'i32', 'i32', 'buffer'],
    pointers: [, 'struct mmsghdr*', , , 'struct timespec*'],
    result: 'i32',
    platform: ['linux']
  },
  read: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  write_string: {
    parameters: ['i32', 'string', 'i32'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }],
    result: 'i32',
    name: 'write'
  },
  write: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  pipe2: {
    parameters: ['u32array', 'i32'],
    pointers: ['int*'],
    result: 'i32',
    platform: ['linux']
  },
  dup2: {
    parameters: ['i32', 'i32'],
    result: 'i32'
  },
  ioctl: {
    parameters: ['i32', 'i32', 'buffer'],
    result: 'i32'
  },
  ioctl2: {
    parameters: ['i32', 'i32', 'i32'],
    result: 'i32',
    name: 'ioctl'
  }
}

const constants = {
  EINPROGRESS: 'i32', 
  EAGAIN: 'i32',
  AF_INET: 'i32', 
  SOCK_STREAM: 'i32', 
  SOL_SOCKET: 'i32', 
  SO_REUSEPORT: 'i32',
  SOMAXCONN: 'i32', 
  MSG_NOSIGNAL: 'i32', 
  SOCK_DGRAM: 'i32', 
  SOCK_RAW: 'i32', 
  SIOCGIFADDR: 'i32', 
  IPPROTO_RAW: 'i32', 
  SIOCSIFFLAGS: 'i32', 
  SIOCSIFADDR: 'i32', 
  SIOCSIFNETMASK: 'i32', 
}

const includes = [
  'sys/socket.h',
  'arpa/inet.h',
  'sys/un.h',
  'sys/ioctl.h',
  'net/if.h',
  'netinet/tcp.h',
  'netinet/if_ether.h',
  'sys/types.h',
  'unistd.h'
]
const name = 'net'

if (globalThis.lo) {
  if (lo.core.os === 'linux') {
    includes.push('linux/if_packet.h')
    includes.push('sys/sendfile.h')
    includes.push('linux/if_tun.h')
    constants.SOCK_NONBLOCK = 'i32'
    constants.SOCKADDR_LEN = 16 // todo
    constants.SOCK_CLOEXEC = 'i32'
    constants.PF_PACKET = 'i32'
    constants.ETH_P_ALL = 'i32'
    constants.ETH_P_ARP = 'i32'
    constants.SIOCGIFHWADDR = 'i32'
    constants.SIOCGIFINDEX = 'i32'
    constants.IFF_TUN = 'i32'
    constants.IFF_TAP = 'i32'
    constants.IFF_NO_PI = 'i32'
    constants.IFF_UP = 'i32'
    constants.TUNSETIFF = 'i32'
    constants.TUNSETPERSIST = 'i32'
  }
}

export { api, includes, name, constants }
