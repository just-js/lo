// sanstun with the crypto offloaded to cells (isolates on their own threads), the same a -> b path as test.js.
// usage: lo lib/sanstun/offload.js [workers=2] [packets=1000000] [size=1400] [atomics|raw] [ring=256] [batch=32]
//
// The main thread owns both interfaces and tunnels (sanstun's state is single-threaded) and runs the pipeline:
//   A  stamp the packet number into the entry's plaintext, tunnel_begin_encapsulate -> the entry's enc slot
//   B  (a worker) pending_encrypt: plaintext -> wire
//   C  interface_receive(wire) -> msg slot, tunnel_begin_decapsulate -> dec slot
//   D  (a worker) pending_decrypt: wire -> plain, -> done slot
//   E  tunnel_commit_decapsulate in packet order, check the packet number came back
// Entries live in one SharedArrayBuffer ring, handed to every cell with Worker.create(0, buf): the cell sees it as
// lo.buffer / lo.buffer_address. Workers only ever pass raw addresses (lo.buffer_address + offset) to the binding.
// Packet s belongs to worker s % workers, which does B and D for its packets in order, so per-worker progress is one
// counter per stage. Sync: `atomics` = Atomics.load/store on the control words, `raw` = plain typed-array
// loads/stores (relies on x86-TSO and the JIT re-reading memory in spin loops: unsafe by design, for comparison).
// workers=0 runs B and D inline on the main thread (the single-thread baseline of the same pipeline).
import { Worker } from 'lib/worker.js'

const { sanstun: st } = lo.load('sanstun')
const { assert, ptr, hrtime, core } = lo

const WORKERS = Number(lo.args[2] ?? 2)
const TOTAL = Number(lo.args[3] ?? 1000000)
const SIZE = Number(lo.args[4] ?? 1400)
const MODE = lo.args[5] ?? 'atomics'
const RING = Number(lo.args[6] ?? 256)
const BATCH = Number(lo.args[7] ?? 32)
assert(MODE === 'atomics' || MODE === 'raw', `mode ${MODE}`)
assert(WORKERS <= 8, 'at most 8 workers')
assert(SIZE >= 4 && SIZE <= 1472, 'size 4..1472')
assert(TOTAL < 2 ** 31, 'packet numbers are int32')

// control words: one int32 per 64-byte line
const LINE = 16
const C_CURSOR_A = 0 * LINE // packets begun (encapsulate), published to workers
const C_CURSOR_C = 1 * LINE // packets received + begun (decapsulate), published to workers
const C_STOP = 2 * LINE
const C_READY = 3 * LINE
const C_DONE_B = 8 * LINE // + k * LINE: worker k's next packet for stage B (all its packets below are encrypted)
const C_DONE_D = 16 * LINE // + k * LINE: the same for stage D
const CTRL = 24 * LINE * 4
// entry layout (bytes)
const SLOT_MSG = 0
const SLOT_ENC = 128
const SLOT_DEC = 256
const SLOT_DONE = 384
const LENS = 512 // u32: wire_len, plain_len, enc rc, dec rc
const PT = 576
const WIRE = PT + 1536
const PLAIN = WIRE + 1536
const ENTRY = PLAIN + 1536 // 5184, a multiple of 64
const CAP = 1536

const worker_source = `
const { sanstun: st } = lo.load('sanstun')
const K = ${WORKERS}, k = Number(lo.args[0]), RING = ${RING}, SIZE = ${SIZE}, RAW = ${MODE === 'raw'}
const LINE = ${LINE}, C_CURSOR_A = ${C_CURSOR_A}, C_CURSOR_C = ${C_CURSOR_C}, C_STOP = ${C_STOP}
const C_READY = ${C_READY}, MINE_B = ${C_DONE_B} + k * LINE, MINE_D = ${C_DONE_D} + k * LINE
const CTRL = ${CTRL}, ENTRY = ${ENTRY}, CAP = ${CAP}
const SLOT_ENC = ${SLOT_ENC}, SLOT_DEC = ${SLOT_DEC}, SLOT_DONE = ${SLOT_DONE}, LENS = ${LENS}
const PT = ${PT}, WIRE = ${WIRE}, PLAIN = ${PLAIN}
const base = lo.buffer_address
const i32 = new Int32Array(lo.buffer)
const u32 = new Uint32Array(lo.buffer)
const load = RAW ? (i => i32[i]) : (i => Atomics.load(i32, i))
const store = RAW ? ((i, v) => { i32[i] = v }) : ((i, v) => Atomics.store(i32, i, v))
Atomics.add(i32, C_READY, 1)
let s = k // next packet for B
let t = k // next packet for D
let enc_ns = 0, dec_ns = 0
const f64 = new Float64Array(lo.buffer)
for (;;) {
  const a = load(C_CURSOR_A)
  if (s < a) {
    const t0 = lo.hrtime()
    do {
      const e = base + CTRL + (s % RING) * ENTRY
      const lens = (e - base + LENS) >> 2
      u32[lens + 2] = st.pending_encrypt(e + SLOT_ENC, e + PT, SIZE, e + WIRE, CAP, e + LENS)
      s += K
    } while (s < a)
    enc_ns += lo.hrtime() - t0
    store(MINE_B, s)
  }
  const c = load(C_CURSOR_C)
  if (t < c) {
    const t0 = lo.hrtime()
    do {
      const e = base + CTRL + (t % RING) * ENTRY
      const lens = (e - base + LENS) >> 2
      u32[lens + 3] = st.pending_decrypt(e + SLOT_DEC, e + WIRE, u32[lens], e + PLAIN, CAP, e + SLOT_DONE)
      t += K
    } while (t < c)
    dec_ns += lo.hrtime() - t0
    store(MINE_D, t)
  }
  if (s >= a && t >= c && load(C_STOP)) break
}
f64[((MINE_B + 2) >> 1)] = enc_ns
f64[((MINE_D + 2) >> 1)] = dec_ns
`

const buf = n => ptr(new Uint8Array(n))
const now = () => hrtime()

// two peers and a completed handshake (as test.js)
function seed () {
  const b = buf(32)
  const fd = core.open('/dev/urandom', core.O_RDONLY)
  assert(fd > 0 && core.read(fd, b.ptr, 32) === 32)
  core.close(fd)
  return b
}
function peer (last) {
  const iface = st.interface_new(seed().ptr, now(), Date.now() * 1e6, 0, 0)
  assert(iface)
  const pub = buf(32)
  assert(st.interface_public(iface, pub.ptr) === 0)
  const ip = buf(16)
  ip.set([192, 0, 2, last])
  return { iface, pub, ip, port: 51820, tunnel: 0 }
}
const out = buf(148)
const out_len = ptr(new Uint32Array(1))
const tunnel_id = ptr(new Uint32Array(1))
const peer_pub = buf(32)
const scratch_slot = buf(128)
const err = ptr(new Int32Array(1))
const a = peer(1)
const b = peer(2)
a.tunnel = st.tunnel_new(a.iface, b.pub.ptr, 0, 0, now(), err.ptr)
b.tunnel = st.tunnel_new(b.iface, a.pub.ptr, 0, 0, now(), err.ptr)
assert(a.tunnel && b.tunnel)
function deliver (to, from, d) {
  return st.interface_receive(to.iface, from.ip.ptr, from.port, 0, d.ptr, d.length, now(), scratch_slot.ptr,
    tunnel_id.ptr, peer_pub.ptr, out.ptr, out_len.ptr)
}
assert(st.tunnel_initiate(a.tunnel, 0, now(), out.ptr, out_len.ptr) === 1)
assert(deliver(b, a, ptr(out.slice(0, out_len[0]))) === 1)
assert(st.tunnel_handle(b.tunnel, scratch_slot.ptr, now(), out.ptr, out_len.ptr) === 1)
assert(deliver(a, b, ptr(out.slice(0, out_len[0]))) === 2)
assert(st.tunnel_handle(a.tunnel, scratch_slot.ptr, now(), out.ptr, out_len.ptr) === 1)
const keepalive = ptr(out.slice(0, out_len[0]))
assert(deliver(b, a, keepalive) === 4)
const tmp = buf(2048)
assert(st.tunnel_decapsulate(b.tunnel, scratch_slot.ptr, keepalive.ptr, keepalive.length, tmp.ptr, tmp.length,
  now(), out_len.ptr) === 1)

// the shared ring
const mem = ptr(new Uint8Array(new SharedArrayBuffer(CTRL + RING * ENTRY)))
const base = mem.ptr
const i32 = new Int32Array(mem.buffer)
const u32 = new Uint32Array(mem.buffer)
const RAW = MODE === 'raw'
const load = RAW ? (i => i32[i]) : (i => Atomics.load(i32, i))
const store = RAW ? ((i, v) => { i32[i] = v }) : ((i, v) => Atomics.store(i32, i, v))
for (let e = 0; e < RING; e++) mem.fill(0x45, CTRL + e * ENTRY + PT, CTRL + e * ENTRY + PT + SIZE)

const workers = []
for (let k = 0; k < WORKERS; k++) {
  const w = new Worker(worker_source, [String(k)])
  w.create(0, mem)
  w.start([1 + (k % 3)])
  workers.push(w)
}
while (Atomics.load(i32, C_READY) < WORKERS) {}
// pin the main thread to cpu 0
{
  const { pthread } = lo.load('pthread')
  const cpu_set = buf(core.struct_cpu_set_t_size || 128)
  cpu_set[0] = 1
  assert(pthread.setAffinity(pthread.self(), cpu_set.length, cpu_set.ptr) === 0)
}

const entry = s => CTRL + (s % RING) * ENTRY
const lens = s => (entry(s) + LENS) >> 2
const ready_b = s => WORKERS === 0 || load(C_DONE_B + (s % WORKERS) * LINE) > s
const ready_d = s => WORKERS === 0 || load(C_DONE_D + (s % WORKERS) * LINE) > s
const expect_len = Math.ceil(SIZE / 16) * 16

let sa = 0 // next packet to begin encapsulating
let sc = 0 // next to receive + begin decapsulating
let se = 0 // next to commit
let busy = 0 // ns in main-loop iterations that made progress
let idle_spins = 0
const start = hrtime()
while (se < TOTAL) {
  const t = now()
  const before = sa + sc + se
  // A
  let n = 0
  while (sa < TOTAL && sa - se < RING && n < BATCH) {
    const e = entry(sa)
    i32[(e + PT) >> 2] = sa
    let rc = st.tunnel_begin_encapsulate(a.tunnel, t, base + e + SLOT_ENC)
    if (rc !== 0) throw new Error(`begin_encapsulate ${rc} at ${sa}`)
    if (WORKERS === 0) {
      rc = st.pending_encrypt(base + e + SLOT_ENC, base + e + PT, SIZE, base + e + WIRE, CAP, base + e + LENS)
      u32[lens(sa) + 2] = rc
    }
    sa++
    n++
  }
  if (n) store(C_CURSOR_A, sa)
  // C
  n = 0
  while (sc < sa && n < BATCH && ready_b(sc)) {
    const e = entry(sc)
    const l = lens(sc)
    if (u32[l + 2] !== 0) throw new Error(`encrypt ${u32[l + 2] | 0} at ${sc}`)
    let rc = st.interface_receive(b.iface, a.ip.ptr, a.port, 0, base + e + WIRE, u32[l], t, base + e + SLOT_MSG,
      tunnel_id.ptr, peer_pub.ptr, out.ptr, out_len.ptr)
    if (rc !== 4) throw new Error(`receive ${rc} at ${sc}`)
    rc = st.tunnel_begin_decapsulate(b.tunnel, base + e + SLOT_MSG, t, base + e + SLOT_DEC)
    if (rc !== 0) throw new Error(`begin_decapsulate ${rc} at ${sc}`)
    if (WORKERS === 0) {
      u32[l + 3] = st.pending_decrypt(base + e + SLOT_DEC, base + e + WIRE, u32[l], base + e + PLAIN, CAP,
        base + e + SLOT_DONE)
    }
    sc++
    n++
  }
  if (n) store(C_CURSOR_C, sc)
  // E
  n = 0
  while (se < sc && n < BATCH && ready_d(se)) {
    const e = entry(se)
    const l = lens(se)
    if (u32[l + 3] !== 0) throw new Error(`decrypt ${u32[l + 3] | 0} at ${se}`)
    const rc = st.tunnel_commit_decapsulate(b.tunnel, base + e + SLOT_DONE, t, base + e + LENS + 4)
    if (rc !== 0) throw new Error(`commit ${rc} at ${se}`)
    if (u32[l + 1] !== expect_len || i32[(e + PLAIN) >> 2] !== se) {
      throw new Error(`packet ${se}: len ${u32[l + 1]} number ${i32[(e + PLAIN) >> 2]}`)
    }
    se++
    n++
  }
  if (sa + sc + se !== before) busy += now() - t
  else idle_spins++
}
const elapsed = hrtime() - start
store(C_STOP, 1)
for (const w of workers) {
  w.waitfor()
  assert(w.exit_code === 0, `worker exit ${w.exit_code}`)
  w.free()
}
const ns = elapsed / TOTAL
const f64 = new Float64Array(mem.buffer)
for (let k = 0; k < WORKERS; k++) {
  const per = TOTAL / WORKERS
  const e = f64[(C_DONE_B + k * LINE + 2) >> 1] / per
  const d = f64[(C_DONE_D + k * LINE + 2) >> 1] / per
  console.log(`worker ${k}: encrypt ${e.toFixed(0)} ns/packet, decrypt ${d.toFixed(0)} ns/packet (busy ${(100 * (e + d) * per / elapsed).toFixed(0)}%)`)
}
console.log(`${WORKERS} workers ${MODE} ring ${RING} batch ${BATCH}: ${TOTAL} x ${SIZE} B a->b in ` +
  `${(elapsed / 1e6).toFixed(0)} ms, ${ns.toFixed(0)} ns/packet, ${((SIZE * 8) / ns).toFixed(2)} Gbit/s, ` +
  `${(1e3 / ns).toFixed(3)} M packets/s, main busy ${(busy / TOTAL).toFixed(0)} ns/packet (${(100 * busy / elapsed).toFixed(0)}%), idle spins ${idle_spins}, all ${TOTAL} checked`)
for (const p of [a, b]) {
  assert(st.tunnel_free(p.tunnel) === 0)
  assert(st.interface_free(p.iface) === 0)
}
