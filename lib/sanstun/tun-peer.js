// A sanstun WireGuard peer on a TUN device, the shape of wireguard-go: plaintext IP packets in and out of a TUN
// (the inner side), encrypted UDP over a connect()ed socket (the outer side), one process per peer, lo's epoll loop.
// usage: lo lib/sanstun/tun-peer.js <tun> <peer_tun> <my_port> <peer_port> <dir> <init|wait> [gso][,vnet][,offload][,tcpco]
//
// - Creates the TUN <tun> (IFF_TUN | IFF_NO_PI, non-persistent: it goes away when this process exits). Addresses,
//   routes and namespaces are the caller's (the bench moves one TUN into another network namespace; the fd keeps
//   working).
// - Keys are swapped through files in <dir> (<tun>.pub, write + rename); `init` sends the handshake initiation.
//   <dir>/<tun>.ready once the TUN and socket exist, <dir>/<tun>.established after the handshake.
// - TUN readable: read one packet per call until EAGAIN, encapsulate, send. Packets before the handshake are dropped.
// - UDP readable: recv until EAGAIN, interface_receive; data: decapsulate and write the plaintext to the TUN (trimmed
//   to the IPv4/IPv6 header's length: sanstun pads to 16 bytes).
// - Options (comma-separated, optional 7th argument):
//   gso   outer batching. Sender: packets read from the TUN are encrypted back to back into one buffer and sent with
//         one sendmsg() and a UDP_SEGMENT cmsg (the ciphertext size of the first; a smaller one ends the batch, a
//         larger one starts a new batch); up to 64 segments / 65,507 bytes, flushed when the TUN read returns
//         EAGAIN, so a slow trickle isn't delayed. Receiver: UDP_GRO, recvmsg() of up to 64 KB, split on the
//         gso_size from the cmsg (no cmsg: one datagram).
//   vnet  coalesced TUN writes: the TUN gets IFF_VNET_HDR. Consecutive decrypted IPv4/UDP packets of one flow
//         (addresses, ports, TOS, TTL, DF; no options, not fragments) with the same payload size (a smaller one
//         ends the group) become one super-packet with a virtio_net_hdr (NEEDS_CSUM, GSO_UDP_L4, gso_size = the
//         payload size): one write, and one wake-up of the receiving socket per group instead of per packet. A
//         UDP_GRO socket gets it as one datagram, others get it segmented by the kernel. Anything else is written
//         alone with an all-zero header, in order (a pending group is flushed first). Flushed when the socket
//         drain hits EAGAIN or the group is full (64 segments / 65,535 bytes of IP). TUN reads carry the 10-byte
//         header too (all zero: no TUNSETOFFLOAD yet, so the kernel never hands us offloaded packets).
//   offload (needs vnet) the TUN read side: TUNSETOFFLOAD CSUM|TSO4|TSO6|USO4|USO6 (this kernel accepts USO only with
//         both), so the kernel hands us TCP/UDP super-packets of up to 64 KB (an inner GSO send, TCP TSO) and packets
//         with partial checksums. A super-packet is split in place: each segment's headers are written just before
//         its payload (over bytes already encrypted), with IPv4 total length/ID/header checksum or IPv6 payload
//         length, TCP sequence number and flags (FIN/PSH only on the last, CWR only on the first) or UDP length, and a
//         full L4 checksum; a partial checksum is completed. Then each segment goes the normal way (gso batching or
//         single sends). IPv6 extension headers are not handled (counted as control errors, dropped).
//   tcpco (needs vnet) coalesced TCP writes too: consecutive in-order IPv4 TCP segments of one flow with only ACK
//         (PSH allowed on the last), the same ack number, window and options, and the same payload size (a smaller
//         one or a PSH ends the group) become one super-packet with a virtio_net_hdr (NEEDS_CSUM, GSO_TCPV4).
//   Without offload/tcpco the plain, gso and vnet paths are unchanged (the earlier rows of lib/sanstun/bench/bench-wireguard-tun.js).
//         Known difference: the coalesced packets' own UDP checksums are replaced (the kernel computes the
//         segments' checksums), so an inner packet that was sent with a bad UDP checksum is delivered instead of
//         dropped. The tunnel itself is authenticated (AEAD); wireguard-go's coalescing has the same shape.
// - Runs until <dir>/stop exists (checked every 50 ms), then writes counters to <dir>/<tun>.txt:
//   "tun_in udp_out udp_in tun_out dropped send_eagain tun_write_errors control_errors tun_win tun_ns udp_win
//   udp_ns udp_send_calls udp_recv_calls tun_writes tun_segs": tun_win..udp_ns are each side's last active window (packets,
//   first to last ns) reading the TUN / the socket, restarted after a 100 ms gap so warm-up packets and the
//   handshake don't stretch it; udp_send_calls..tun_writes count the syscalls that moved data (batching factors);
//   tun_segs is the packets produced from TUN reads (= tun_in without offload, more with super-packets).
// - PEER_STATS=1 (diagnostics only): ns spent per stage, and the main thread's on-CPU / runqueue-wait ns from
//   /proc/self/schedstat between the start of each side's last window and exit, written to <dir>/<tun>.stats.
// - Not yet: TUNSETOFFLOAD (super-packets from the TUN, splitting them), cookie-reply source addresses (the
//   connected peer's address is passed to receive).
import { Node } from 'lib/udp.js'
import { Loop } from 'lib/loop.js'
import { net } from 'lib/net.js'
import { Device } from 'lib/tuntap.js'

const { sanstun: st } = lo.load('sanstun')
const { assert, ptr, hrtime, core } = lo
const enc = new TextEncoder()
const dec = new TextDecoder()

const [TUN, PEER_TUN, MY_PORT, PEER_PORT, DIR, MODE, OPTS = ''] = lo.args.slice(2)
assert(TUN && PEER_TUN && DIR && (MODE === 'init' || MODE === 'wait'),
  'usage: tun-peer.js <tun> <peer_tun> <my_port> <peer_port> <dir> <init|wait> [gso][,vnet]')
const opts = OPTS.split(',').filter(Boolean)
for (const o of opts) assert(['gso', 'vnet', 'offload', 'tcpco'].includes(o), `unknown option ${o}`)
const GSO = opts.includes('gso')
const VNET = opts.includes('vnet')
const OFFLOAD = opts.includes('offload')
const TCPCO = opts.includes('tcpco')
assert(VNET || (!OFFLOAD && !TCPCO), 'offload and tcpco need vnet')
const VH = VNET ? 10 : 0 // sizeof(struct virtio_net_hdr) in front of every TUN read/write
const PEER = Number(PEER_PORT)

const exists = path => core.access(path, 0) === 0
const write_text = (path, s) => core.write_file(path, enc.encode(s))
const read_text = path => dec.decode(core.read_file(path))
const hex = b => Array.from(b, v => v.toString(16).padStart(2, '0')).join('')
const unhex = s => Uint8Array.from(s.match(/../g), h => parseInt(h, 16))
const buf = n => ptr(new Uint8Array(n))
function wait_for (path, secs = 10) {
  const t = hrtime()
  while (!exists(path)) { core.usleep(1000); assert(hrtime() - t < secs * 1e9, `timeout waiting for ${path}`) }
}
const SOL_SOCKET = 1, SO_RCVBUFFORCE = 33, SO_SNDBUFFORCE = 32
const SOL_UDP = 17, UDP_SEGMENT = 103, UDP_GRO = 104
const EAGAIN = 11
const CAP = 65536 + 64 // a TUN packet (up to 64 KB with offloads later) + the WireGuard overhead
const SEG_MAX = 64 // UDP_MAX_SEGMENTS
const GSO_BYTES = 65507 // UDP payload limit of one send
const SINGLE_MAX = 1500 // larger TUN packets go out alone (GSO batches only MTU-sized ones)

// ---------------------------------------------------------------------------------------------------------------
// sanstun interface, keys, tunnel (as peer.js)
const seed = buf(32)
{
  const fd = core.open('/dev/urandom', core.O_RDONLY)
  assert(fd > 0 && core.read(fd, seed.ptr, 32) === 32)
  core.close(fd)
}
const iface = st.interface_new(seed.ptr, hrtime(), Date.now() * 1e6, 0, 0)
assert(iface)
seed.fill(0)
const my_pub = buf(32)
assert(st.interface_public(iface, my_pub.ptr) === 0)
write_text(`${DIR}/${TUN}.pub.tmp`, hex(my_pub))
assert(core.rename(`${DIR}/${TUN}.pub.tmp`, `${DIR}/${TUN}.pub`) === 0, `rename ${lo.errno}`)
wait_for(`${DIR}/${PEER_TUN}.pub`)
const peer_pub = ptr(unhex(read_text(`${DIR}/${PEER_TUN}.pub`).trim()))
assert(peer_pub.length === 32, `bad peer key in ${DIR}/${PEER_TUN}.pub`)
const err = ptr(new Int32Array(1))
const tunnel = st.tunnel_new(iface, peer_pub.ptr, 0, 0, hrtime(), err.ptr)
assert(tunnel, `tunnel_new ${err[0]}`)

// ---------------------------------------------------------------------------------------------------------------
// counters
let tun_in = 0, udp_out = 0, udp_in = 0, tun_out = 0, dropped = 0, send_eagain = 0, tun_write_errors = 0
let control_errors = 0, udp_send_calls = 0, udp_recv_calls = 0, tun_writes = 0, tun_segs = 0
let tun_first = 0, tun_last = 0, udp_first = 0, udp_last = 0, tun_win = 0, udp_win = 0
const GAP = 100e6
const STATS = lo.getenv('PEER_STATS') === '1'
// /proc/self/schedstat: "<on-CPU ns> <runqueue wait ns> <timeslices>" (CONFIG_SCHED_INFO); read_file is empty for /proc
const sched_buf = ptr(new Uint8Array(128))
function schedstat () {
  const fd = core.open('/proc/self/schedstat', core.O_RDONLY)
  const n = core.read(fd, sched_buf.ptr, sched_buf.length)
  core.close(fd)
  return dec.decode(sched_buf.subarray(0, n > 0 ? n : 0)).trim().split(' ').map(Number)
}
let tun_sched = null, udp_sched = null
const stats = { split_out_ns: 0, l4_csum_ns: 0, tun_read_ns: 0, encap_ns: 0, send_ns: 0, recv_ns: 0, decap_ns: 0, tun_write_ns: 0, empty_reads: 0, empty_recvs: 0 }
let established = false

// buffers
const pkt = buf(CAP) // a packet read from the TUN (with VNET: the 10-byte header first)
const wire = buf(CAP) // the ciphertext of a single packet
const wire_len = ptr(new Uint32Array(1))
const rbuf = buf(CAP) // a datagram (with GSO: a GRO super-datagram) from the socket
const plain = buf(CAP) // decrypted packets land at plain + VH, so a single write can include the (zero) header
const plain_len = ptr(new Uint32Array(1))
const out = buf(148) // handshake / keepalive / cookie reply
const out_len = ptr(new Uint32Array(1))
const slot = buf(128)
const tid = ptr(new Uint32Array(1))
const scratch_pub = buf(32)
const peer_ip = buf(16)
peer_ip.set([127, 0, 0, 1])

const loop = new Loop()
const node = new Node(loop)
const dev = new Device(pkt)

function send_out () { net.send(node.fd, out.ptr, out_len[0], 0) }
function drain_events () {
  const times = drain_events.times ||= ptr(new BigUint64Array(2))
  for (;;) {
    const ev = st.tunnel_poll_event(tunnel, out.ptr, out_len.ptr, times.ptr)
    if (ev === 0) return
    if (ev === 1 || ev === 2) send_out()
    if (ev === 3 && !established) {
      established = true
      write_text(`${DIR}/${TUN}.established`, '1\n')
    }
  }
}
let next_deadline = 0
function timers (now) {
  if (now < next_deadline) return
  st.tunnel_handle_timeout(tunnel, now)
  drain_events()
  const d = st.tunnel_poll_timeout(tunnel)
  next_deadline = d >= 2 ** 63 ? now + 1e9 : Math.min(d, now + 1e9)
}

// a msghdr with one iovec and room for one cmsg (connected socket: no name); lengths are written through 32-bit
// views (the high halves stay 0), so no BigInt on the data path
function msg (base, ctl_size) {
  const hdr = buf(56), iov = buf(16), ctl = buf(ctl_size)
  const hv = new DataView(hdr.buffer)
  hv.setBigUint64(16, BigInt(iov.ptr), true) // msg_iov
  hv.setBigUint64(24, 1n, true) // msg_iovlen
  hv.setBigUint64(32, BigInt(ctl.ptr), true) // msg_control
  new DataView(iov.buffer).setBigUint64(0, BigInt(base), true)
  return { hdr, ctl, h32: new Uint32Array(hdr.buffer), i32: new Uint32Array(iov.buffer), cv: new DataView(ctl.buffer) }
}

// ---------------------------------------------------------------------------------------------------------------
// inner -> outer
// a datagram for the peer: on EAGAIN spin a little (on loopback the send buffer drains as the peer's socket queues
// it), then drop, as a full device queue would
function send_wire (len) {
  for (let tries = 0; tries < 64; tries++) {
    if (net.send(node.fd, wire.ptr, len, 0) >= 0) { udp_out++; udp_send_calls++; return }
    if (lo.errno !== EAGAIN) break
    send_eagain++
  }
  dropped++
}
function send_single (p, n, now) {
  const rc = st.tunnel_encapsulate(tunnel, p, n, wire.ptr, CAP, now, wire_len.ptr)
  if (rc !== 0) { dropped++; return } // no session yet, or an error
  send_wire(wire_len[0])
}

// GSO batch: ciphertexts back to back in gbuf, g_seg the first one's size
const gbuf = GSO ? buf(GSO_BYTES + 2048) : null
const smsg = GSO ? msg(gbuf.ptr, 24) : null
if (GSO) {
  // struct cmsghdr { size_t cmsg_len = CMSG_LEN(2) = 18; int level = SOL_UDP; int type = UDP_SEGMENT; u16 size }
  smsg.cv.setUint32(0, 18, true)
  smsg.cv.setInt32(8, SOL_UDP, true)
  smsg.cv.setInt32(12, UDP_SEGMENT, true)
}
let g_off = 0, g_n = 0, g_seg = 0
function flush_out () {
  if (g_n === 0) return
  const t0 = STATS ? hrtime() : 0
  let ok = false
  if (g_n === 1) {
    ok = net.send(node.fd, gbuf.ptr, g_off, 0) >= 0
    for (let tries = 0; !ok && lo.errno === EAGAIN && tries < 64; tries++) { send_eagain++; ok = net.send(node.fd, gbuf.ptr, g_off, 0) >= 0 }
  } else {
    smsg.i32[2] = g_off // iov_len
    smsg.cv.setUint16(16, g_seg, true) // gso_size
    smsg.h32[10] = 24 // msg_controllen = CMSG_SPACE(2)
    ok = net.sendmsg(node.fd, smsg.hdr.ptr, 0) >= 0
    for (let tries = 0; !ok && lo.errno === EAGAIN && tries < 64; tries++) { send_eagain++; ok = net.sendmsg(node.fd, smsg.hdr.ptr, 0) >= 0 }
  }
  if (ok) { udp_out += g_n; udp_send_calls++ } else dropped += g_n
  g_off = g_n = 0
  if (STATS) stats.send_ns += hrtime() - t0
}
function batch_out (p, n, now) {
  if (n > SINGLE_MAX) { flush_out(); send_single(p, n, now); return }
  if (g_n === SEG_MAX || g_off + SINGLE_MAX + 32 > GSO_BYTES) flush_out()
  const rc = st.tunnel_encapsulate(tunnel, p, n, gbuf.ptr + g_off, GSO_BYTES + 2048 - g_off, now, wire_len.ptr)
  if (rc !== 0) { dropped++; return }
  const wl = wire_len[0]
  if (g_n === 0) { g_seg = wl; g_off = wl; g_n = 1; return }
  if (wl > g_seg) {
    // bigger than the batch's segment size: send the batch, then this one starts the next
    const at = g_off
    flush_out()
    gbuf.copyWithin(0, at, at + wl)
    g_seg = wl; g_off = wl; g_n = 1
    return
  }
  g_off += wl
  g_n++
  if (wl < g_seg) flush_out() // a shorter segment must be the last one
}

// ---- offload: split TUN super-packets, complete partial checksums ----
// one's-complement sums over little-endian words (RFC 1071: byte order only swaps the result), 32 bits at a time
// through a DataView (unaligned is fine); a JS number holds the running sum exactly
const pdv = new DataView(pkt.buffer)
const hdr = OFFLOAD ? buf(128) : null // the super-packet's pristine IP + L4 headers
const hdr_dv = OFFLOAD ? new DataView(hdr.buffer) : null
const swap16 = x => ((x & 0xff) << 8) | (x >> 8)
const fold64 = s => { while (s > 0xffff) s = (s % 65536) + Math.floor(s / 65536); return s }
// even offsets (the usual case): one u16 to reach 4-byte alignment, then u32 words split into 16-bit halves, so the
// loop stays in integer math (~380 ns per 1,392 B in isolation, vs ~500 for the DataView loop)
const pu16 = new Uint16Array(pkt.buffer), pu32 = new Uint32Array(pkt.buffer)
function sum_le (off, len) {
  if (off & 1) {
    let s = 0, i = 0
    for (; i + 4 <= len; i += 4) s += pdv.getUint32(off + i, true)
    if (i + 2 <= len) { s += pdv.getUint16(off + i, true); i += 2 }
    if (i < len) s += pkt[off + i]
    return s
  }
  let lo16 = 0, hi16 = 0, i = off
  const end = off + len
  if ((i & 2) && i + 2 <= end) { lo16 += pu16[i >> 1]; i += 2 }
  const e4 = i + ((end - i) & ~3)
  for (let k = i >> 2, ke = e4 >> 2; k < ke; k++) { const w = pu32[k]; lo16 += w & 0xffff; hi16 += w >>> 16 }
  i = e4
  if (i + 2 <= end) { lo16 += pu16[i >> 1]; i += 2 }
  if (i < end) lo16 += pkt[i]
  return lo16 + hi16
}
// store ~sum (a little-endian-word sum) as a big-endian checksum at off; zero_is_ffff for UDP
function put_csum (off, s, zero_is_ffff) {
  let ck = (~swap16(fold64(s))) & 0xffff
  if (ck === 0 && zero_is_ffff) ck = 0xffff
  pkt[off] = ck >> 8; pkt[off + 1] = ck & 0xff
}
// pseudo-header sum for the IP packet at s (v4: addresses at 12, v6: at 8), protocol and L4 length
const pseudo = (v, s, proto, len) => (v === 4 ? sum_le(s + 12, 8) : sum_le(s + 8, 32)) + swap16(proto) + swap16(len)
function offload_out (n, now) {
  const B = VH, p = pkt
  const gt = p[1] & 0x7f // gso_type without the ECN bit
  if (gt === 0) { // no GSO: maybe a partial checksum (NEEDS_CSUM) to complete
    if (p[0] & 1) {
      const cs = B + pdv.getUint16(6, true), field = cs + pdv.getUint16(8, true)
      put_csum(field, sum_le(cs, B + n - cs), pdv.getUint16(8, true) === 6)
    }
    tun_segs++
    if (GSO) batch_out(pkt.ptr + B, n, now)
    else send_single(pkt.ptr + B, n, now)
    return
  }
  const v = p[B] >> 4
  let ihl, proto
  if (v === 4) { ihl = (p[B] & 15) * 4; proto = p[B + 9] } else if (v === 6) { ihl = 40; proto = p[B + 6] } else { control_errors++; return }
  const gso = pdv.getUint16(4, true)
  if ((proto !== 6 && proto !== 17) || gso === 0) { control_errors++; return } // e.g. IPv6 extension headers
  const thl = proto === 6 ? (p[B + ihl + 12] >> 4) * 4 : 8
  const hlen = ihl + thl, total = n - hlen
  core.memcpy(hdr.ptr, pkt.ptr + B, hlen)
  const id = v === 4 ? (hdr[4] << 8) | hdr[5] : 0
  const seq = proto === 6 ? hdr_dv.getUint32(ihl + 4) : 0
  const cso = proto === 6 ? 16 : 6
  for (let off = 0, i = 0; off < total; off += gso, i++) {
    const seg = Math.min(gso, total - off), last = off + seg >= total
    const s = B + off // the segment's headers go right before its payload
    if (off) core.memcpy(pkt.ptr + s, hdr.ptr, hlen)
    const L = hlen + seg
    if (v === 4) {
      p[s + 2] = L >> 8; p[s + 3] = L & 0xff
      const nid = (id + i) & 0xffff
      p[s + 4] = nid >> 8; p[s + 5] = nid & 0xff
      p[s + 10] = 0; p[s + 11] = 0
      put_csum(s + 10, sum_le(s, ihl), false)
    } else {
      p[s + 4] = (L - 40) >> 8; p[s + 5] = (L - 40) & 0xff
    }
    const t = s + ihl
    if (proto === 6) {
      pdv.setUint32(t + 4, (seq + off) >>> 0)
      if (!last) p[t + 13] &= ~0x09 // FIN, PSH only on the last
      if (off) p[t + 13] &= ~0x80 // CWR only on the first
    } else {
      p[t + 4] = (thl + seg) >> 8; p[t + 5] = (thl + seg) & 0xff
    }
    p[t + cso] = 0; p[t + cso + 1] = 0
    const c0 = STATS ? hrtime() : 0
    put_csum(t + cso, sum_le(t, thl + seg) + pseudo(v, s, proto, thl + seg), proto === 17)
    tun_segs++
    const c1 = STATS ? hrtime() : 0
    if (STATS) stats.l4_csum_ns += c1 - c0
    if (GSO) batch_out(pkt.ptr + s, L, now)
    else send_single(pkt.ptr + s, L, now)
    if (STATS) stats.split_out_ns += hrtime() - c1
  }
}

function on_tun_readable () {
  for (;;) {
    const t0 = STATS ? hrtime() : 0
    const n = dev.read() - VH
    if (STATS) { stats.tun_read_ns += hrtime() - t0; if (n <= 0) stats.empty_reads++ }
    if (n <= 0) break
    tun_in++
    const now = hrtime()
    if (now - tun_last > GAP) { tun_first = now; tun_win = 0; if (STATS) tun_sched = schedstat() }
    tun_win++
    tun_last = now
    if (OFFLOAD) offload_out(n, now)
    else {
      if (VNET && pkt[0] !== 0) control_errors++ // NEEDS_CSUM/GSO from the TUN: can't happen without TUNSETOFFLOAD
      tun_segs++
      if (GSO) batch_out(pkt.ptr + VH, n, now)
      else send_single(pkt.ptr + VH, n, now)
    }
    if (STATS) stats.encap_ns += hrtime() - now // single: includes the send
  }
  if (GSO) flush_out()
}

// ---------------------------------------------------------------------------------------------------------------
// outer -> inner
// the IP packet's own length (sanstun returns the plaintext padded to 16 bytes); the packet is at plain + VH
function ip_len (n) {
  const p = plain, o = VH
  const v = p[o] >> 4
  if (v === 4 && n >= 20) return Math.min(n, (p[o + 2] << 8) | p[o + 3])
  if (v === 6 && n >= 40) return Math.min(n, 40 + ((p[o + 4] << 8) | p[o + 5]))
  return 0
}

// coalesced TUN writes: co holds the virtio_net_hdr + the group's first packet + the others' UDP payloads
const co = VNET ? buf(10 + 65535) : null
const cov = VNET ? new DataView(co.buffer) : null
let co_n = 0, co_len = 0, co_seg = 0 // packets, bytes of IP packet at co + 10, UDP payload size per segment
let co_proto = 17, co_thl = 0, co_next = 0 // tcpco: the group's protocol, TCP header length, next expected sequence
function sum16 (b, off, len, s) {
  for (let i = 0; i < len; i += 2) s += (b[off + i] << 8) | b[off + i + 1]
  return s
}
const fold = s => { while (s > 0xffff) s = (s & 0xffff) + (s >>> 16); return s }
function write_tun (b, len, packets) {
  const t0 = STATS ? hrtime() : 0
  if (dev.write(b, len) === len) { tun_out += packets; tun_writes++ } else tun_write_errors += packets
  if (STATS) stats.tun_write_ns += hrtime() - t0
}
function flush_in () {
  if (co_n === 0) return
  if (co_n === 1) {
    co.fill(0, 0, 10) // the packet as it came, its own checksum intact
  } else if (co_proto === 6) {
    const ip = 10, t = 30, tlen = co_len - 20
    co[ip + 2] = co_len >> 8; co[ip + 3] = co_len & 0xff
    co[ip + 10] = 0; co[ip + 11] = 0
    const ipck = (~fold(sum16(co, ip, 20, 0))) & 0xffff
    co[ip + 10] = ipck >> 8; co[ip + 11] = ipck & 0xff
    const ph = fold(sum16(co, ip + 12, 8, 6 + tlen)) // partial: the pseudo-header sum, not complemented
    co[t + 16] = ph >> 8; co[t + 17] = ph & 0xff
    co[0] = 1 // VIRTIO_NET_HDR_F_NEEDS_CSUM
    co[1] = 1 // VIRTIO_NET_HDR_GSO_TCPV4
    cov.setUint16(2, 20 + co_thl, true) // hdr_len
    cov.setUint16(4, co_seg, true) // gso_size
    cov.setUint16(6, 20, true) // csum_start
    cov.setUint16(8, 16, true) // csum_offset
  } else {
    const ip = 10, u = 30, ulen = co_len - 20
    co[ip + 2] = co_len >> 8; co[ip + 3] = co_len & 0xff // total length
    co[ip + 10] = 0; co[ip + 11] = 0
    const ipck = (~fold(sum16(co, ip, 20, 0))) & 0xffff
    co[ip + 10] = ipck >> 8; co[ip + 11] = ipck & 0xff
    co[u + 4] = ulen >> 8; co[u + 5] = ulen & 0xff // UDP length
    // CHECKSUM_PARTIAL: the pseudo-header sum (addresses, protocol, UDP length), folded, not complemented
    const ph = fold(sum16(co, ip + 12, 8, 17 + ulen))
    co[u + 6] = ph >> 8; co[u + 7] = ph & 0xff
    co[0] = 1 // VIRTIO_NET_HDR_F_NEEDS_CSUM
    co[1] = 5 // VIRTIO_NET_HDR_GSO_UDP_L4
    cov.setUint16(2, 28, true) // hdr_len
    cov.setUint16(4, co_seg, true) // gso_size
    cov.setUint16(6, 20, true) // csum_start
    cov.setUint16(8, 6, true) // csum_offset
  }
  write_tun(co, 10 + co_len, co_n)
  co_n = 0
}
// same flow as the group (the packet at plain + 10, the group's first at co + 10): TOS, flags (DF), TTL,
// addresses, ports
function same_flow () {
  const p = plain
  if (p[11] !== co[11] || p[16] !== co[16] || p[18] !== co[18] || p[19] !== co[19]) return false
  for (let i = 22; i < 34; i++) if (p[i] !== co[i]) return false
  return true
}
function deliver (len) {
  if (!VNET) { write_tun(plain, len, 1); return }
  const p = plain // the packet starts at p[10]; p[0..10) is never written: an all-zero header for single writes
  if (TCPCO && p[10] === 0x45 && p[19] === 6 && (((p[16] << 8) | p[17]) & 0x3fff) === 0) { deliver_tcp(len); return }
  const pl = len - 28
  const coalescable = p[10] === 0x45 && p[19] === 17 && pl > 0 && (((p[16] << 8) | p[17]) & 0x3fff) === 0 &&
    ((p[34] << 8) | p[35]) === len - 20
  if (!coalescable) {
    flush_in()
    write_tun(plain, 10 + len, 1)
    return
  }
  if (co_n > 0 && (pl > co_seg || co_n === SEG_MAX || co_len + pl > 65535 || !same_flow())) flush_in()
  if (co_n === 0) {
    core.memcpy(co.ptr + 10, plain.ptr + 10, len)
    co_len = len; co_seg = pl; co_n = 1; co_proto = 17
    return
  }
  core.memcpy(co.ptr + 10 + co_len, plain.ptr + 38, pl)
  co_len += pl
  co_n++
  if (pl < co_seg) flush_in() // a shorter segment ends the group
}

// tcpco: an IPv4 TCP segment at plain + 10 (TCP header at plain + 30)
const plain_dv = new DataView(plain.buffer)
function deliver_tcp (len) {
  const p = plain
  const thl = (p[42] >> 4) * 4, pl = len - 20 - thl, fl = p[43]
  if (pl <= 0 || (fl & 0x10) === 0 || (fl & ~0x18) !== 0) { flush_in(); write_tun(plain, 10 + len, 1); return }
  const seq = plain_dv.getUint32(34)
  if (co_n > 0) {
    let ok = co_proto === 6 && thl === co_thl && seq === co_next && pl <= co_seg && co_n < SEG_MAX &&
      co_len + pl <= 65535 && same_flow()
    // the same ack number, window, urgent pointer and options as the group's first segment
    for (let i = 38; ok && i < 30 + thl; i++) if (i !== 42 && i !== 43 && i !== 46 && i !== 47 && p[i] !== co[i]) ok = false
    if (!ok) flush_in()
  }
  if (co_n === 0) {
    core.memcpy(co.ptr + 10, plain.ptr + 10, len)
    co_len = len; co_seg = pl; co_n = 1; co_proto = 6; co_thl = thl; co_next = (seq + pl) >>> 0
    if (fl & 0x08) flush_in() // PSH: nothing may follow it in a group
    return
  }
  core.memcpy(co.ptr + 10 + co_len, plain.ptr + 30 + thl, pl)
  co_len += pl
  co_n++
  co_next = (co_next + pl) >>> 0
  if (fl & 0x08) { co[43] |= 0x08; flush_in() } else if (pl < co_seg) flush_in()
}

function handle_dgram (d, n, now) {
  const kind = st.interface_receive(iface, peer_ip.ptr, PEER, 0, d, n, now, slot.ptr, tid.ptr,
    scratch_pub.ptr, out.ptr, out_len.ptr)
  if (kind === 4) {
    const rc = st.tunnel_decapsulate(tunnel, slot.ptr, d, n, plain.ptr + VH, CAP - VH, now, plain_len.ptr)
    if (rc === 0) {
      const len = ip_len(plain_len[0])
      if (STATS) stats.decap_ns += hrtime() - now // includes interface_receive
      if (len) deliver(len)
      else tun_write_errors++
    } else if (rc !== 1) control_errors++ // 1: keepalive
  } else if (kind === 5) send_out() // cookie reply
  else if (kind > 0) {
    const rc = st.tunnel_handle(tunnel, slot.ptr, now, out.ptr, out_len.ptr)
    if (rc === 1) send_out()
    else if (rc < 0) control_errors++
    drain_events()
  } else control_errors++
}

const rmsg = GSO ? msg(rbuf.ptr, 64) : null
if (GSO) rmsg.i32[2] = CAP // iov_len
function on_udp_readable () {
  for (;;) {
    const t0 = STATS ? hrtime() : 0
    let n, seg
    if (GSO) {
      rmsg.h32[10] = 64 // msg_controllen
      n = net.recvmsg(node.fd, rmsg.hdr.ptr, 0)
      // a UDP_GRO cmsg (level SOL_UDP, type UDP_GRO, int gso_size) means n is a train of seg-byte datagrams
      seg = n > 0 && rmsg.h32[10] >= 20 && rmsg.cv.getInt32(8, true) === SOL_UDP && rmsg.cv.getInt32(12, true) === UDP_GRO
        ? rmsg.cv.getInt32(16, true) : n
    } else {
      n = net.recv(node.fd, rbuf.ptr, CAP, 0)
      seg = n
    }
    if (STATS) { stats.recv_ns += hrtime() - t0; if (n < 0) stats.empty_recvs++ }
    if (n < 0) break
    udp_recv_calls++
    for (let off = 0; off < n; off += seg) {
      udp_in++
      const now = hrtime()
      if (now - udp_last > GAP) { udp_first = now; udp_win = 0; if (STATS) udp_sched = schedstat() }
      udp_win++
      udp_last = now
      handle_dgram(rbuf.ptr + off, Math.min(seg, n - off), now)
    }
  }
  if (VNET) flush_in()
}

// ---------------------------------------------------------------------------------------------------------------
dev.create(TUN, 'tun', false, VNET ? Device.IFF_VNET_HDR : 0)
dev.nonBlocking()
if (OFFLOAD) {
  const TUNSETOFFLOAD = 0x400454d0 // _IOW('T', 208, unsigned int)
  const TUN_F = 0x01 | 0x02 | 0x04 | 0x20 | 0x40 // CSUM | TSO4 | TSO6 | USO4 | USO6
  assert(net.ioctl2(dev.fd, TUNSETOFFLOAD, TUN_F) === 0, `TUNSETOFFLOAD ${lo.errno}`)
}
assert(loop.add(dev.fd, on_tun_readable) === 0, `loop.add tun ${lo.errno}`)
node.bind('127.0.0.1', on_udp_readable, Number(MY_PORT))
{
  const v = ptr(new Int32Array([32 << 20]))
  net.setsockopt(node.fd, SOL_SOCKET, SO_RCVBUFFORCE, v.ptr, 4)
  net.setsockopt(node.fd, SOL_SOCKET, SO_SNDBUFFORCE, v.ptr, 4)
  if (GSO) {
    const one = ptr(new Int32Array([1]))
    assert(net.setsockopt(node.fd, SOL_UDP, UDP_GRO, one.ptr, 4) === 0, `UDP_GRO ${lo.errno}`)
  }
}
assert(node.connect('127.0.0.1', PEER) === 0, `connect ${lo.errno}`)
write_text(`${DIR}/${TUN}.ready`, '1\n')

if (MODE === 'init') {
  wait_for(`${DIR}/${PEER_TUN}.ready`)
  assert(st.tunnel_initiate(tunnel, 0, hrtime(), out.ptr, out_len.ptr) === 1, 'tunnel_initiate')
  send_out()
}
let next_stop_check = 0
for (;;) {
  loop.poll(10)
  const now = hrtime()
  timers(now)
  if (now >= next_stop_check) {
    if (exists(`${DIR}/stop`)) break
    next_stop_check = now + 50e6
  }
}
write_text(`${DIR}/${TUN}.txt`,
  `${tun_in} ${udp_out} ${udp_in} ${tun_out} ${dropped} ${send_eagain} ${tun_write_errors} ${control_errors} ` +
  `${tun_win} ${tun_last - tun_first} ${udp_win} ${udp_last - udp_first} ${udp_send_calls} ${udp_recv_calls} ${tun_writes} ${tun_segs}\n`)
if (STATS) {
  const end = schedstat()
  const since = a => a ? { run_ns: end[0] - a[0], wait_ns: end[1] - a[1], slices: end[2] - a[2] } : null
  stats.tun_window_sched = since(tun_sched)
  stats.udp_window_sched = since(udp_sched)
  stats.exit_ns_after_tun_window = tun_sched ? hrtime() - tun_last : 0
  stats.exit_ns_after_udp_window = udp_sched ? hrtime() - udp_last : 0
  write_text(`${DIR}/${TUN}.stats`, JSON.stringify(stats) + '\n')
}
node.close()
dev.close()
st.tunnel_free(tunnel)
st.interface_free(iface)
