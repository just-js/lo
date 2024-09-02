const { wireguard } = lo.load('wireguard')
const { get_address } = lo

function inet_aton (ip) {
  const [b0, b1, b2, b3] = ip.split('.').map(v => (parseInt(v, 10) & 0xff))
  return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3
}

class Peer {
  constructor () {
    this.raw = new Uint8Array(4 + 32 + 32 + 28 + 16 + 8 + 8 + 2 + 6 + 8 + 8 + 8)
    this.view = new DataView(this.raw.buffer)
    this.ptr = get_address(this.raw)
    this.devices = ''
  }

  set flags (flags) {
    this.view.setInt32(0, flags, true)
  }

  get pubkey () {
    return this.raw.subarray(4, 36)
  }

  get sharedkey () {
    return this.raw.subarray(36, 68)
  }

  set endpoint ({ ip, port }) {
    const { view } = this
    view.setInt16(68, AF_INET, true)
    view.setUint16(70, port & 0xffff)
    view.setUint32(72, inet_aton(ip))
  }

  set handshake (timestamp) {
    this.view.setBigInt64(96, BigInt(timestamp * 1000), true)
    this.view.setBigInt64(104, BigInt(timestamp * 1000), true)
  }

  set rx (bytes) {
    this.view.setBigInt64(112, BigInt(bytes), true)
  }

  set tx (bytes) {
    this.view.setBigInt64(120, BigInt(bytes), true)
  }

  set keepalive (interval) {
    this.view.setUint16(128, interval, true)
  }

  set firstip (ptr) {
    this.view.setBigUint64(136, BigInt(ptr), true)
  }

  get firstip () {
    return Number(this.view.getBigUint64(136, true))
  }

  set lastip (ptr) {
    this.view.setBigUint64(144, BigInt(ptr), true)
  }

  set next (ptr) {
    this.view.setBigUint64(152, BigInt(ptr), true)
  }

  get next () {
    return Number(this.view.getBigUint64(152, true))
  }
}

class AllowedIP {
  constructor () {
    this.raw = new Uint8Array(2 + 16 + 1 + 8)
    this.view = new DataView(this.raw.buffer)
    this.ptr = get_address(this.raw)
  }

  set family (id) {
    this.view.setUint16(0, id, true)
  }

  set address4 (ip) {
    this.view.setUint32(4, inet_aton(ip))
  }

  set cidr (v) {
    this.view.setUint8(20, v)
  }

  set next (ptr) {
    this.view.setBigUint64(21, BigInt(ptr), true)
  }
}

class Device {
  constructor () {
    this.raw = new Uint8Array(IFNAMSIZ + 4 + 4 + 32 + 32 + 4 + 2 + 2 + 8 + 8)
    this.view = new DataView(this.raw.buffer)
    this.ptr = get_address(this.raw)
    this.encoder = new TextEncoder()
  }

  set name (n) {
    this.encoder.encodeInto(n.slice(0, IFNAMSIZ), this.raw)
  }

  set ifindex (i) {
    this.view.setUint32(IFNAMSIZ, i, true)
  }

  set flags (flags) {
    this.view.setInt32(IFNAMSIZ + 4, flags, true)
  }

  get flags () {
    return this.view.getInt32(IFNAMSIZ + 4, true)
  }

  get pubkey () {
    return this.raw.subarray(IFNAMSIZ + 8, IFNAMSIZ + 40)
  }

  get privkey () {
    return this.raw.subarray(IFNAMSIZ + 40, IFNAMSIZ + 72)
  }

  set fwmark (v) {
    this.view.setUint32(IFNAMSIZ + 72, v, true)
  }

  set port (p) {
    this.view.setUint16(IFNAMSIZ + 76, p, true)
  }

  set first (ptr) {
    this.view.setBigUint64(IFNAMSIZ + 80, BigInt(ptr), true)
  }

  get first () {
    return Number(this.view.getBigUint64(IFNAMSIZ + 80, true))
  }

  set last (ptr) {
    this.view.setBigUint64(IFNAMSIZ + 88, BigInt(ptr), true)
  }

  get last () {
    return Number(this.view.getBigUint64(IFNAMSIZ + 88, true))
  }
}

const AF_INET = 2
const IFNAMSIZ = 16
const WGDEVICE_REPLACE_PEERS = 1
const WGDEVICE_HAS_PRIVATE_KEY = 2
const WGDEVICE_HAS_PUBLIC_KEY = 4
const WGDEVICE_HAS_LISTEN_PORT = 8
const WGDEVICE_HAS_FWMARK = 16
const WGPEER_REMOVE_ME = 1
const WGPEER_REPLACE_ALLOWEDIPS = 2
const WGPEER_HAS_PUBLIC_KEY = 4
const WGPEER_HAS_PRESHARED_KEY = 8
const WGPEER_HAS_PERSISTENT_KEEPALIVE_INTERVAL = 16

const handle = new Uint32Array(2)
wireguard.list = lo.wrap(handle, wireguard.list, 0)

export {
  Peer, Device, AllowedIP,
  WGDEVICE_REPLACE_PEERS,
  WGDEVICE_HAS_PRIVATE_KEY,
  WGDEVICE_HAS_PUBLIC_KEY,
  WGDEVICE_HAS_LISTEN_PORT,
  WGDEVICE_HAS_FWMARK,
  WGPEER_REMOVE_ME,
  WGPEER_REPLACE_ALLOWEDIPS,
  WGPEER_HAS_PUBLIC_KEY,
  WGPEER_HAS_PRESHARED_KEY,
  WGPEER_HAS_PERSISTENT_KEEPALIVE_INTERVAL,
  wireguard
}
