const { system } = spin.load('system')
const { assert, utf8Decode, readMemory } = spin

import {
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
} from 'lib/wireguard.js'

const peer = new Peer()
peer.flags = WGPEER_HAS_PUBLIC_KEY | WGPEER_REPLACE_ALLOWEDIPS
const device = new Device()
device.name = 'wgtest0'
device.port = 8888
device.flags = WGDEVICE_HAS_PRIVATE_KEY | WGDEVICE_HAS_LISTEN_PORT
device.first = peer.ptr
device.last = peer.ptr
const tmpKey = new Uint8Array(32)
wireguard.genprivKey(tmpKey)
wireguard.genpubKey(peer.pubkey, tmpKey)
wireguard.genprivKey(device.privkey)
wireguard.delete('wgtest0')
assert(wireguard.add('wgtest0') === 0)
assert(wireguard.set(device.ptr) === 0)
const devices = utf8Decode(wireguard.list(), -1)

const dptr = new Uint8Array(8)
const dptr32 = new Uint32Array(dptr.buffer)
assert(wireguard.get(dptr, 'wgtest0') === 0)
const dev = new Device()
readMemory(dev.raw, spin.addr(dptr32), dev.raw.length)
if ((dev.flags & WGDEVICE_HAS_PUBLIC_KEY) === WGDEVICE_HAS_PUBLIC_KEY) {
  console.log(`dev ${dev.pubkey}`)
}
let np = dev.first
while (np) {
  const p = new Peer()
  readMemory(p.raw, np, p.raw.length)
  console.log(`peer ${p.pubkey}`)
  np = p.next
}
system.sleep(10)
assert(wireguard.delete('wgtest0') === 0)
