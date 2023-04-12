import { Library } from 'lib/ffi.js'
import { dump } from 'lib/binary.js'
import {
  Peer,
  Device,
  AllowedIP,
  WGDEVICE_HAS_PRIVATE_KEY,
  WGDEVICE_HAS_LISTEN_PORT,
  WGPEER_REPLACE_ALLOWEDIPS,
  WGPEER_HAS_PUBLIC_KEY,
  wireguard
} from 'lib/wireguard.js'

const { assert, args } = spin

const std = (new Library()).open().compile(`
#include <unistd.h>
#include <sys/un.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <linux/if_tun.h>
#include <linux/rtnetlink.h>
#include <errno.h>
#include <netdb.h>

#define INET_ADDRLEN 4
#define INET6_ADDRLEN 16

int string_to_ip (const char *string, struct sockaddr_storage *ss) {
  struct addrinfo hints, *ai;
  int ret;
  if (ss == NULL) {
    return -EFAULT;
  }
  memset(&hints, 0, sizeof(hints));
  hints.ai_family = AF_UNSPEC;
  hints.ai_flags = AI_NUMERICHOST;
  hints.ai_socktype = SOCK_DGRAM;
  ret = getaddrinfo(string, NULL, &hints, &ai);
  if (ret == 0) {
    memcpy(ss, ai->ai_addr, ai->ai_addrlen);
    freeaddrinfo(ai);
  } else {
    ret = (ret == EAI_SYSTEM) ? -errno : -EINVAL;
  }
  return ret;
}

int set_address (int action, const char *name, const char *address, int prefixlen) {
  int ifindex, s, len, ret;
  struct sockaddr_storage ss;
  void *addr;
  size_t addrlen;
  struct {
    struct nlmsghdr n;
    struct ifaddrmsg r;
    char attrbuf[NLMSG_ALIGN(sizeof(struct nlmsghdr)) +
      NLMSG_ALIGN(sizeof(struct rtattr)) +
      NLMSG_ALIGN(INET6_ADDRLEN)];
  } req;
  struct rtattr *rta;
  struct nlmsghdr *nh;
  struct nlmsgerr *err;
  char buf[NLMSG_ALIGN(sizeof(struct nlmsghdr)) +
    NLMSG_ALIGN(sizeof(struct nlmsgerr)) +
    NLMSG_ALIGN(sizeof(struct nlmsghdr))];
  ifindex = if_nametoindex(name);
  if (ifindex == 0) {
    return -errno;
  }
  ret = string_to_ip(address, &ss);
  if (ret) {
      return ret;
  }
  if (ss.ss_family == AF_INET) {
    struct sockaddr_in *sin = (struct sockaddr_in *) &ss;
    addr = &sin->sin_addr;
    addrlen = INET_ADDRLEN;
  } else if (ss.ss_family == AF_INET6) {
    struct sockaddr_in6 *sin6 = (struct sockaddr_in6 *) &ss;
    addr = &sin6->sin6_addr;
    addrlen = INET6_ADDRLEN;
  } else {
    return -EAFNOSUPPORT;
  }
  memset(&req, 0, sizeof(req));
  req.n.nlmsg_len = NLMSG_LENGTH(sizeof(req.r));
  req.n.nlmsg_type = action;
  req.n.nlmsg_flags = NLM_F_REQUEST | NLM_F_ACK;
  req.n.nlmsg_pid = getpid();
  req.r.ifa_family = ss.ss_family;
  req.r.ifa_prefixlen = prefixlen;
  req.r.ifa_index = ifindex;
  rta = (struct rtattr *) (((char *) &req) + NLMSG_ALIGN(req.n.nlmsg_len));
  rta->rta_type = IFA_LOCAL;
  rta->rta_len = RTA_LENGTH(addrlen);
  req.n.nlmsg_len = NLMSG_ALIGN(req.n.nlmsg_len) + RTA_LENGTH(addrlen);
  memcpy(RTA_DATA(rta), addr, addrlen);
  s = socket(PF_NETLINK, SOCK_RAW | SOCK_CLOEXEC, NETLINK_ROUTE);
  if (send(s, &req, req.n.nlmsg_len, 0) < 0) {
    close(s);
    return -errno;
  }
  len = recv(s, buf, sizeof(buf), 0);
  close(s);
  if (len < 0) {
    return -errno;
  }
  nh = (struct nlmsghdr *) buf;
  if (!NLMSG_OK(nh, (unsigned) len) || nh->nlmsg_type != NLMSG_ERROR) {
    return -EINVAL;
  }
  err = (struct nlmsgerr*)NLMSG_DATA(nh);
  return err->error;
}

int device_up (int fd, const char* name) {
  struct ifreq ifr;
  memset(&ifr, 0, sizeof(ifr));
  strncpy(ifr.ifr_name, name, sizeof(ifr.ifr_name));
  ifr.ifr_flags = IFF_UP;
  return ioctl(fd, SIOCSIFFLAGS, (void*)&ifr);
}

int device_down (int fd, const char* name) {
  struct ifreq ifr;
  memset(&ifr, 0, sizeof(ifr));
  strncpy(ifr.ifr_name, name, sizeof(ifr.ifr_name));
  ifr.ifr_flags = 0;
  return ioctl(fd, SIOCSIFFLAGS, (void*)&ifr);
}
`).bind({
  socket: { parameters: ['i32', 'i32', 'i32'], result: 'i32' },
  close: { parameters: ['i32'], result: 'i32' },
  set_address: { parameters: ['i32', 'string', 'string', 'i32'], result: 'i32', internal: true },
  device_up: { parameters: ['i32', 'string'], result: 'i32', internal: true },
  device_down: { parameters: ['i32', 'string'], result: 'i32', internal: true },
})

const SOCK_DGRAM = 2 // for IP frames
const AF_INET = 2
const RTM_NEWADDR = 20
const RTM_DELADDR = 21
const peerFlags = WGPEER_HAS_PUBLIC_KEY | WGPEER_REPLACE_ALLOWEDIPS
const deviceFlags = WGDEVICE_HAS_PRIVATE_KEY | WGDEVICE_HAS_LISTEN_PORT

const serverName = 'wgserver'
const serverIP = '10.0.0.1'
const serverPort = 8888
const serverCIDR = 24

const clientName = 'wgclient'
const clientIP = '10.0.0.2'
const clientCIDR = 32

const fd = std.socket(AF_INET, SOCK_DGRAM, 0)
assert(fd > 2)
const command = args[2] || 'down'
if (command === 'up') {
  const serverPrivKey = new Uint8Array(32)
  const serverPubKey = new Uint8Array(32)
  wireguard.genprivKey(serverPrivKey)
  wireguard.genpubKey(serverPubKey, serverPrivKey)

  const clientPrivKey = new Uint8Array(32)
  const clientPubKey = new Uint8Array(32)
  wireguard.genprivKey(clientPrivKey)
  wireguard.genpubKey(clientPubKey, clientPrivKey)

  const server = new Peer()
  server.flags = peerFlags
  const serverallowedIp = new AllowedIP()
  serverallowedIp.family = AF_INET
  serverallowedIp.address4 = clientIP
  serverallowedIp.cidr = clientCIDR
  server.firstip = serverallowedIp.ptr
  server.lastip = serverallowedIp.ptr

  const client = new Peer()
  client.flags = peerFlags
  const clientallowedIp = new AllowedIP()
  clientallowedIp.family = AF_INET
  clientallowedIp.address4 = serverIP
  clientallowedIp.cidr = serverCIDR
  client.firstip = clientallowedIp.ptr
  client.lastip = clientallowedIp.ptr
  client.endpoint = { ip: serverIP, port: serverPort }

  const sdevice = new Device()
  sdevice.name = serverName
  sdevice.port = serverPort
  sdevice.flags = deviceFlags
  sdevice.first = server.ptr
  sdevice.last = server.ptr
  sdevice.privkey.set(serverPrivKey)

  const cdevice = new Device()
  cdevice.name = clientName
  cdevice.flags = deviceFlags
  cdevice.first = client.ptr
  cdevice.last = client.ptr
  cdevice.privkey.set(clientPrivKey)

  server.pubkey.set(clientPubKey)
  client.pubkey.set(serverPubKey)

  assert(wireguard.add(serverName) === 0)
  assert(wireguard.set(sdevice.ptr) === 0)

  assert(wireguard.add(clientName) === 0)
  assert(wireguard.set(cdevice.ptr) === 0)

  assert(std.set_address(RTM_NEWADDR, serverName, serverIP, serverCIDR) === 0)
  assert(std.device_up(fd, serverName) === 0)
  assert(std.set_address(RTM_NEWADDR, clientName, clientIP, clientCIDR) === 0)
  assert(std.device_up(fd, clientName) === 0)
} else {
  assert(std.set_address(RTM_DELADDR, serverName, serverIP, serverCIDR) === 0)
  assert(std.device_down(fd, serverName) === 0)
  assert(std.set_address(RTM_DELADDR, clientName, clientIP, clientCIDR) === 0)
  assert(std.device_down(fd, clientName) === 0)
  assert(wireguard.delete(serverName) === 0)
  assert(wireguard.delete(clientName) === 0)
}
std.close(fd)

