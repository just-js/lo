// lib/sanstun smoke test + microbenchmark: two WireGuard peers in one process, no sockets.
// usage: lo lib/sanstun/test.js [packets for the benchmark, default 100000] [packet size, default 1400]
const { sanstun: st } = lo.load('sanstun')
const { assert, ptr, hrtime, core } = lo

const SLOT = 128
const DGRAM = 148
const ST_NEVER = 2 ** 64 - 1

const buf = n => ptr(new Uint8Array(n))
const u32 = n => ptr(new Uint32Array(n))
const hex = b => Array.from(b, v => v.toString(16).padStart(2, '0')).join('')
const copy = (src, len) => ptr(src.slice(0, len))
const now = () => hrtime()
const unix = () => Date.now() * 1e6

function seed () {
  const b = buf(32)
  const fd = core.open('/dev/urandom', core.O_RDONLY)
  assert(fd > 0)
  assert(core.read(fd, b.ptr, 32) === 32)
  core.close(fd)
  return b
}

function peer (name, ip) {
  const s = seed()
  const iface = st.interface_new(s.ptr, now(), unix(), 0, 0)
  assert(iface)
  s.fill(0)
  const pub = buf(32)
  assert(st.interface_public(iface, pub.ptr) === 0)
  return { name, iface, pub, ip: buf(16).fill(0), port: 51820, tunnel: 0 }
}

const out = buf(DGRAM)
const out_len = u32(1)
const tunnel_id = u32(1)
const peer_pub = buf(32)
const msg = buf(SLOT)
const err = ptr(new Int32Array(1))
const times = ptr(new BigUint64Array(2))

// Pass datagram d (Uint8Array with .ptr) from `from` to `to`; returns the message kind, the parsed message in msg.
function receive (to, from, d) {
  return st.interface_receive(to.iface, from.ip.ptr, from.port, 0, d.ptr, d.length, now(), msg.ptr,
    tunnel_id.ptr, peer_pub.ptr, out.ptr, out_len.ptr)
}

function events (p) {
  const seen = []
  for (;;) {
    const ev = st.tunnel_poll_event(p.tunnel, out.ptr, out_len.ptr, times.ptr)
    if (ev === 0) break
    seen.push(ev)
  }
  return seen
}

const a = peer('a', [192, 0, 2, 1])
a.ip.set([192, 0, 2, 1])
const b = peer('b', [192, 0, 2, 2])
b.ip.set([192, 0, 2, 2])
console.log(`a ${hex(a.pub)}`)
console.log(`b ${hex(b.pub)}`)

a.tunnel = st.tunnel_new(a.iface, b.pub.ptr, 0, 0, now(), err.ptr)
assert(a.tunnel, `tunnel_new ${err[0]}`)
b.tunnel = st.tunnel_new(b.iface, a.pub.ptr, 0, 0, now(), err.ptr)
assert(b.tunnel, `tunnel_new ${err[0]}`)
console.log(`tunnel ids a ${st.tunnel_id(a.tunnel)} b ${st.tunnel_id(b.tunnel)}`)

// handshake: a -> init -> b -> response -> a -> keepalive -> b
let t0 = hrtime()
assert(st.tunnel_initiate(a.tunnel, 0, now(), out.ptr, out_len.ptr) === 1)
const init = copy(out, out_len[0])
assert(init.length === 148)
assert(receive(b, a, init) === 1, 'expected an initiation')
assert(hex(peer_pub) === hex(a.pub), 'initiation names a')
assert(st.tunnel_handle(b.tunnel, msg.ptr, now(), out.ptr, out_len.ptr) === 1)
const resp = copy(out, out_len[0])
assert(resp.length === 92)
assert(receive(a, b, resp) === 2, 'expected a response')
assert(tunnel_id[0] === st.tunnel_id(a.tunnel), `response routed to ${tunnel_id[0]}`)
assert(st.tunnel_handle(a.tunnel, msg.ptr, now(), out.ptr, out_len.ptr) === 1)
const keepalive = copy(out, out_len[0])
assert(keepalive.length === 32)
assert(events(a).join() === '3', 'a established')
assert(receive(b, a, keepalive) === 4, 'expected data')
assert(tunnel_id[0] === st.tunnel_id(b.tunnel))
const plain = buf(2048)
const plain_len = u32(1)
assert(st.tunnel_decapsulate(b.tunnel, msg.ptr, keepalive.ptr, keepalive.length, plain.ptr, plain.length, now(),
  plain_len.ptr) === 1, 'expected a keepalive')
assert(events(b).join() === '3', 'b established')
console.log(`handshake ok in ${((hrtime() - t0) / 1e3).toFixed(0)} us (3 messages, 2 interfaces)`)

// data both ways, fused path
const enc = new TextEncoder()
const dec = new TextDecoder()
const wire = buf(2048)
const wire_len = u32(1)
function send (from, to, text) {
  const pt = ptr(enc.encode(text))
  assert(st.tunnel_encapsulate(from.tunnel, pt.ptr, pt.length, wire.ptr, wire.length, now(), wire_len.ptr) === 0)
  const d = copy(wire, wire_len[0])
  assert(receive(to, from, d) === 4)
  const rc = st.tunnel_decapsulate(to.tunnel, msg.ptr, d.ptr, d.length, plain.ptr, plain.length, now(),
    plain_len.ptr)
  assert(rc === 0, `decapsulate ${rc}`)
  const got = dec.decode(plain.subarray(0, plain_len[0])).replace(/\0+$/, '')
  assert(got === text, `got ${got}`)
  return d
}
const d1 = send(a, b, 'hello from a')
send(b, a, 'hello from b')
console.log('data a->b and b->a ok (fused path)')

// replay: the same datagram again is parsed, decrypts, but the commit rejects the counter
assert(receive(b, a, d1) === 4)
let rc = st.tunnel_decapsulate(b.tunnel, msg.ptr, d1.ptr, d1.length, plain.ptr, plain.length, now(), plain_len.ptr)
assert(rc === -9, `replay gave ${rc}, expected -9 DuplicateCounter`)
// tampering: flip a ciphertext byte
const d2 = send(a, b, 'another one')
assert(st.tunnel_encapsulate(a.tunnel, ptr(enc.encode('tamper me')).ptr, 9, wire.ptr, wire.length, now(),
  wire_len.ptr) === 0)
const bad = copy(wire, wire_len[0])
bad[20] ^= 1
assert(receive(b, a, bad) === 4)
rc = st.tunnel_decapsulate(b.tunnel, msg.ptr, bad.ptr, bad.length, plain.ptr, plain.length, now(), plain_len.ptr)
assert(rc === -7, `tampered gave ${rc}, expected -7 InvalidAeadTag`)
// garbage
const junk = buf(64).fill(7)
rc = receive(b, a, junk)
assert(rc < 0, `junk gave ${rc}`)
console.log(`replay -9, tamper -7, junk ${rc}: rejected`)

// split path: begin/commit on the tunnel, encrypt/decrypt from slots (what other threads would do)
const pending = buf(SLOT)
const decrypted = buf(SLOT)
{
  const pt = ptr(enc.encode('split path'))
  assert(st.tunnel_begin_encapsulate(a.tunnel, now(), pending.ptr) === 0)
  assert(st.pending_encrypt(pending.ptr, pt.ptr, pt.length, wire.ptr, wire.length, wire_len.ptr) === 0)
  const d = copy(wire, wire_len[0])
  assert(receive(b, a, d) === 4)
  assert(st.tunnel_begin_decapsulate(b.tunnel, msg.ptr, now(), pending.ptr) === 0)
  assert(st.pending_decrypt(pending.ptr, d.ptr, d.length, plain.ptr, plain.length, decrypted.ptr) === 0)
  assert(st.tunnel_commit_decapsulate(b.tunnel, decrypted.ptr, now(), plain_len.ptr) === 0)
  assert(dec.decode(plain.subarray(0, plain_len[0])).replace(/\0+$/, '') === 'split path')
  // wrong-kind / empty slot use is an error, not a crash
  assert(st.pending_encrypt(pending.ptr, pt.ptr, pt.length, wire.ptr, wire.length, wire_len.ptr) === -20)
  assert(st.slot_drop(pending.ptr) === 0)
}
console.log('split path ok, empty slot -20')

// timers
const deadline = st.tunnel_poll_timeout(a.tunnel)
assert(deadline !== ST_NEVER && deadline > 0)
assert(st.tunnel_handle_timeout(a.tunnel, now()) === 0)
console.log(`next deadline for a in ${((deadline - now()) / 1e9).toFixed(1)} s, events after timeout: [${events(a)}]`)

// benchmark: encapsulate at a, receive + decapsulate at b
const count = Number(lo.args[2] || 100000)
const size = Number(lo.args[3] || 1400)
const pkt = buf(size).fill(0x45)
let enc_ns = 0
let dec_ns = 0
for (let i = 0; i < count; i++) {
  const t = now()
  rc = st.tunnel_encapsulate(a.tunnel, pkt.ptr, size, wire.ptr, wire.length, t, wire_len.ptr)
  const t1 = now()
  if (rc !== 0) throw new Error(`encapsulate ${rc}`)
  rc = st.interface_receive(b.iface, a.ip.ptr, a.port, 0, wire.ptr, wire_len[0], t1, msg.ptr,
    tunnel_id.ptr, peer_pub.ptr, out.ptr, out_len.ptr)
  if (rc !== 4) throw new Error(`receive ${rc}`)
  rc = st.tunnel_decapsulate(b.tunnel, msg.ptr, wire.ptr, wire_len[0], plain.ptr, plain.length, t1, plain_len.ptr)
  const t2 = now()
  if (rc !== 0) throw new Error(`decapsulate ${rc} at ${i}`)
  enc_ns += t1 - t
  dec_ns += t2 - t1
}
const gbit = ns => ((size * 8) / ns).toFixed(2)
console.log(`${count} x ${size} B: encapsulate ${(enc_ns / count).toFixed(0)} ns (${gbit(enc_ns / count)} Gbit/s), ` +
  `receive+decapsulate ${(dec_ns / count).toFixed(0)} ns (${gbit(dec_ns / count)} Gbit/s), one core`)

for (const p of [a, b]) {
  st.slot_drop(msg.ptr)
  assert(st.tunnel_free(p.tunnel) === 0)
  assert(st.interface_free(p.iface) === 0)
}
console.log('ok')
