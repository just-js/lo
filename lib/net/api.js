const api = {
  socket: {
    parameters: ['i32', 'i32', 'i32'],
    result: 'i32'
  },
  socketpair: {
    parameters: ['i32', 'i32', 'i32', 'pointer'],
    pointers: [, , , 'int*'],
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
  send: {
    parameters: ['i32', 'buffer', 'u32', 'i32'],
    result: 'i32'
  },
  send_string: {
    parameters: ['i32', 'string', 'u32', 'i32'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }, 0],
    result: 'i32',
    name: 'send'
  },
  send2: {
    parameters: ['i32', 'pointer', 'u32', 'i32'],
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
  recvmsg: {
    parameters: ['i32', 'buffer', 'u32'],
    pointers: [, 'msghdr*'],
    result: 'i32'
  },
  read: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  write_string: {
    parameters: ['i32', 'string', 'i32'],
    // we can add an override which reference another parameter and sets the param to a field/property of it
//    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }],
    result: 'i32',
    name: 'write'
  },
  write: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  dup2: {
    parameters: ['i32', 'i32'],
    result: 'i32'
  },
  getsockname: {
    parameters: ['i32', 'buffer', 'u32array'],
    pointers: [, 'struct sockaddr*', 'socklen_t*'],
    result: 'i32'
  },
}

const constants = {
  EINPROGRESS: 'i32',
  EAGAIN: 'i32',
  AF_INET: 'i32',
  AF_UNIX: 'i32',
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
  SOCKADDR_LEN: 16,
  TCP_NODELAY: 'i32',
  SO_REUSEADDR: 'i32',
  IPPROTO_TCP: 'i32',
  SO_KEEPALIVE: 'i32',
  INADDR_ANY: 'i32',
  IPPROTO_IP: 'i32',
  IP_ADD_MEMBERSHIP: 'i32'
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

const linux = {
  includes: [
    'linux/if_packet.h',
    'sys/sendfile.h',
    'linux/if_tun.h',
  ],
  constants: {
    SOCK_NONBLOCK: 'i32',
    SOCK_CLOEXEC: 'i32',
    PF_PACKET: 'i32',
    ETH_P_ALL: 'i32',
    ETH_P_ARP: 'i32',
    SIOCGIFHWADDR: 'i32',
    SIOCGIFINDEX: 'i32',
    IFF_TUN: 'i32',
    IFF_TAP: 'i32',
    IFF_NO_PI: 'i32',
    IFF_UP: 'i32',
    TUNSETIFF: 'i32',
    TUNSETPERSIST: 'i32',
    TCP_CORK: 'i32',
    SOCK_SEQPACKET: 'i32'
  },
  api: {
    recvmmsg: {
      parameters: ['i32', 'buffer', 'i32', 'i32', 'buffer'],
      pointers: [, 'struct mmsghdr*', , , 'struct timespec*'],
      result: 'i32',
    },
    sendmmsg: {
      parameters: ['i32', 'buffer', 'i32', 'i32'],
      pointers: [, 'struct mmsghdr*'],
      result: 'i32',
    },
    pipe2: {
      parameters: ['u32array', 'i32'],
      pointers: ['int*'],
      result: 'i32',
    },
    accept4: {
      parameters: ['i32', 'pointer', 'pointer', 'i32'],
      pointers: [, 'sockaddr*', 'socklen_t*'],
      result: 'i32',
    },
    ioctl: {
      parameters: ['i32', 'u32', 'buffer'],
      result: 'i32'
    },
    ioctl2: {
      parameters: ['i32', 'u32', 'i32'],
      result: 'i32',
      name: 'ioctl'
    },
    ioctl3: {
      parameters: ['i32', 'u32', 'pointer'],
      result: 'i32',
      name: 'ioctl'
    }
  }
}

const structs = ['ip_mreq']

export { api, includes, name, constants, structs, linux }
