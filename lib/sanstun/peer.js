// A sanstun WireGuard peer over real UDP, driven by lo's epoll loop: one process per peer.
// usage: lo lib/sanstun/peer.js <send|recv> <workers> <packets> <size> <my_port> <peer_port> <dir> [gso]
//
// Both peers run a sanstun Interface + Tunnel and a connect()ed non-blocking UDP socket on 127.0.0.1 (lib/udp.js
// Node + lib/loop.js Loop). They swap public keys through files in <dir> (<role>.pub, recv.ready), then the sender
// initiates the handshake over the socket. The sender stamps a sequence number into each inner packet of <size>
// bytes, encapsulates it and sends the ciphertext (one send() per packet; EAGAIN -> back to the loop); the receiver
// drains its socket in the readable callback (one recv() per packet), receive + decapsulate + commit, and checks
// every sequence number. Results go to <dir>/<role>.txt: recv "<got> <first-to-last ns> <bad>", send
// "<sent> <eagain> <ns>".
// workers > 0: the crypto moves to cells (isolates on threads) through the same SharedArrayBuffer ring as
// offload.js. Sender: main does begin_encapsulate + send, workers encrypt. Receiver: main recv()s straight into the
// ring entry and does receive + begin_decapsulate, workers decrypt, main commits in order.
// gso (optional): the sender encrypts up to GSO_MAX packets back to back at the ciphertext stride (SEG bytes, all
// data messages of the stream are the same size) and sends them with one send()/sendmsg() and UDP_SEGMENT = SEG;
// the receiver sets UDP_GRO and reads coalesced super-datagrams of up to 64 KB, split on the SEG stride (a shorter
// last piece, e.g. a keepalive, is handled). With workers, sendmsg() takes an iovec over the ready ring entries,
// and recvmsg() scatters a super-datagram straight into GSO_MAX ring entries (only read when that many are free).
// No sendmmsg/recvmmsg, and the source address passed to the interface is the connected peer's.
import { Node } from 'lib/udp.js'
import { Loop } from 'lib/loop.js'
import { Worker } from 'lib/worker.js'
import { net } from 'lib/net.js'

const { sanstun: st } = lo.load('sanstun')
const { assert, ptr, hrtime, core } = lo
const enc = new TextEncoder()
const dec = new TextDecoder()

const [ROLE, W, N, S, MY_PORT, PEER_PORT, DIR, OPT] = lo.args.slice(2)
const GSO = OPT === 'gso'
// PEER_STATS=1: the receiver writes timing counters to <dir>/recv.stats (diagnostics, not used by the benches)
const STATS = lo.getenv('PEER_STATS') === '1'
const stats = { readable: 0, ring_full: 0, recv_calls: 0, segs: 0, recv_ns: 0, commit_ns: 0, commits: 0, idle_polls: 0 }
const WORKERS = Number(W), TOTAL = Number(N), SIZE = Number(S), PEER = Number(PEER_PORT)
assert(ROLE === 'send' || ROLE === 'recv', `role ${ROLE}`)
assert(SIZE >= 4 && SIZE <= 1472 && WORKERS <= 8)

const exists = path => { const fd = core.open(path, core.O_RDONLY); if (fd < 0) return false; core.close(fd); return true }
const write_text = (path, s) => core.write_file(path, enc.encode(s))
const read_text = path => dec.decode(core.read_file(path))
const hex = b => Array.from(b, v => v.toString(16).padStart(2, '0')).join('')
const unhex = s => Uint8Array.from(s.match(/../g), h => parseInt(h, 16))
function wait_for (path, secs = 10) {
  const t = hrtime()
  while (!exists(path)) { core.usleep(1000); assert(hrtime() - t < secs * 1e9, `timeout waiting for ${path}`) }
}
const buf = n => ptr(new Uint8Array(n))
const SOL_SOCKET = 1, SO_RCVBUFFORCE = 33, SO_SNDBUFFORCE = 32
const SOL_UDP = 17, UDP_SEGMENT = 103, UDP_GRO = 104
const SEG = 32 + Math.ceil(SIZE / 16) * 16 // a data message: 16 header + padded payload + 16 tag
const GSO_MAX = Math.floor(65507 / SEG)
const GRO_BUF = 65536
function udp_opt (fd, opt, v) {
  const b = ptr(new Int32Array([v]))
  assert(net.setsockopt(fd, SOL_UDP, opt, b.ptr, 4) === 0, `setsockopt SOL_UDP ${opt}: ${lo.errno}`)
}
// a msghdr with an iovec array of n entries (connected socket: no name)
function iov_msg (n) {
  const hdr = ptr(new Uint8Array(56))
  const iov = ptr(new Uint8Array(16 * n))
  const hv = new DataView(hdr.buffer)
  hv.setBigUint64(16, BigInt(iov.ptr), true)
  return { hdr, iov, hv, iv: new DataView(iov.buffer), set (i, addr, len) { this.iv.setBigUint64(i * 16, BigInt(addr), true); this.iv.setBigUint64(i * 16 + 8, BigInt(len), true) }, count (k) { this.hv.setBigUint64(24, BigInt(k), true) } }
}

// ---------------------------------------------------------------------------------------------------------------
// sanstun interface, keys swapped through files, tunnel
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
// write then rename: the other side polls for the file and must never read a half-written key
write_text(`${DIR}/${ROLE}.pub.tmp`, hex(my_pub))
assert(core.rename(`${DIR}/${ROLE}.pub.tmp`, `${DIR}/${ROLE}.pub`) === 0, `rename ${lo.errno}`)
const other = ROLE === 'send' ? 'recv' : 'send'
wait_for(`${DIR}/${other}.pub`)
const peer_pub = ptr(unhex(read_text(`${DIR}/${other}.pub`).trim()))
assert(peer_pub.length === 32, `bad peer key in ${DIR}/${other}.pub`)
const err = ptr(new Int32Array(1))
const tunnel = st.tunnel_new(iface, peer_pub.ptr, 0, 0, hrtime(), err.ptr)
assert(tunnel, `tunnel_new ${err[0]}`)

// socket
const loop = new Loop()
const node = new Node(loop)
const peer_ip = buf(16)
peer_ip.set([127, 0, 0, 1])
const out = buf(148)
const out_len = ptr(new Uint32Array(1))
const tid = ptr(new Uint32Array(1))
const scratch_pub = buf(32)
const scratch_slot = buf(128)
const rbuf = buf(2048) // control messages / single-thread receive
const rplain = buf(2048)
const rlen = ptr(new Uint32Array(1))
const rplain_i32 = new Int32Array(rplain.buffer, 0, 1)
let established = false
let control_errors = 0

function send_out () { // a datagram sanstun produced (handshake, keepalive, cookie reply) in out
  net.send(node.fd, out.ptr, out_len[0], 0)
}
// a parsed non-data message in `slot`
function handle_control (kind, slot) {
  if (kind === 5) return send_out() // cookie reply
  const rc = st.tunnel_handle(tunnel, slot, hrtime(), out.ptr, out_len.ptr)
  if (rc === 1) send_out()
  else if (rc < 0) control_errors++
}
function drain_events () {
  const times = drain_events.times ||= ptr(new BigUint64Array(2))
  for (;;) {
    const ev = st.tunnel_poll_event(tunnel, out.ptr, out_len.ptr, times.ptr)
    if (ev === 0) return
    if (ev === 1 || ev === 2) send_out()
    if (ev === 3) established = true
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

// ---------------------------------------------------------------------------------------------------------------
// the offload ring (offload.js's layout and worker)
const LINE = 16
const C_CURSOR_A = 0, C_CURSOR_C = LINE, C_STOP = 2 * LINE, C_READY = 3 * LINE
const C_DONE_B = 8 * LINE, C_DONE_D = 16 * LINE
const CTRL = 24 * LINE * 4
const SLOT_MSG = 0, SLOT_ENC = 128, SLOT_DEC = 256, SLOT_DONE = 384, LENS = 512
const PT = 576, WIRE = PT + 1536, PLAIN = WIRE + 1536, ENTRY = PLAIN + 1536, CAP = 1536
const RING = 256
let mem, base = 0, i32, u32
const workers = []
if (WORKERS > 0) {
  mem = ptr(new Uint8Array(new SharedArrayBuffer(CTRL + RING * ENTRY)))
  base = mem.ptr
  i32 = new Int32Array(mem.buffer)
  u32 = new Uint32Array(mem.buffer)
  for (let e = 0; e < RING; e++) mem.fill(0x45, CTRL + e * ENTRY + PT, CTRL + e * ENTRY + PT + SIZE)
  const source = `
const { sanstun: st } = lo.load('sanstun')
const K = ${WORKERS}, k = Number(lo.args[0]), RING = ${RING}, SIZE = ${SIZE}
const LINE = ${LINE}, MINE_B = ${C_DONE_B} + k * LINE, MINE_D = ${C_DONE_D} + k * LINE
const CTRL = ${CTRL}, ENTRY = ${ENTRY}, CAP = ${CAP}
const base = lo.buffer_address
const i32 = new Int32Array(lo.buffer)
const u32 = new Uint32Array(lo.buffer)
const f64 = new Float64Array(lo.buffer)
Atomics.add(i32, ${C_READY}, 1)
let s = k, t = k
for (;;) {
  const a = Atomics.load(i32, ${C_CURSOR_A})
  if (s < a) {
    do {
      const e = base + CTRL + (s % RING) * ENTRY
      const l = (e - base + ${LENS}) >> 2
      u32[l + 2] = st.pending_encrypt(e + ${SLOT_ENC}, e + ${PT}, SIZE, e + ${WIRE}, CAP, e + ${LENS})
      s += K
    } while (s < a)
    Atomics.store(i32, MINE_B, s)
  }
  const c = Atomics.load(i32, ${C_CURSOR_C})
  if (t < c) {
    const t0 = lo.hrtime()
    do {
      const e = base + CTRL + (t % RING) * ENTRY
      const l = (e - base + ${LENS}) >> 2
      u32[l + 3] = st.pending_decrypt(e + ${SLOT_DEC}, e + ${WIRE}, u32[l], e + ${PLAIN}, CAP, e + ${SLOT_DONE})
      t += K
    } while (t < c)
    f64[(MINE_D + 2) >> 1] += lo.hrtime() - t0
    Atomics.store(i32, MINE_D, t)
  }
  if (s >= a && t >= c && Atomics.load(i32, ${C_STOP})) break
}
`
  for (let k = 0; k < WORKERS; k++) {
    const w = new Worker(source, [String(k)])
    w.create(0, mem)
    w.start()
    workers.push(w)
  }
  while (Atomics.load(i32, C_READY) < WORKERS) {}
}
const entry = s => CTRL + (s % RING) * ENTRY
const lens = s => (entry(s) + LENS) >> 2
const ready_b = s => Atomics.load(i32, C_DONE_B + (s % WORKERS) * LINE) > s
const ready_d = s => Atomics.load(i32, C_DONE_D + (s % WORKERS) * LINE) > s

// ---------------------------------------------------------------------------------------------------------------
// receiver
let got = 0, bad = 0, first = 0, last = 0, prev = -1
let sc = 0, se = 0 // offload: next entry to receive into, next to commit
const expect_len = Math.ceil(SIZE / 16) * 16
function delivered (number, len) {
  const now = hrtime()
  if (!first) first = now
  last = now
  got++
  // numbers only increase: a gap is loss (counted by the bench from got vs sent), a step back is reorder/replay
  if (len !== expect_len || number <= prev) bad++
  prev = number
}
function on_readable_recv_single () {
  for (;;) {
    const n = net.recv(node.fd, rbuf.ptr, rbuf.length, 0)
    if (n < 0) return
    const now = hrtime()
    const kind = st.interface_receive(iface, peer_ip.ptr, PEER, 0, rbuf.ptr, n, now, scratch_slot.ptr, tid.ptr,
      scratch_pub.ptr, out.ptr, out_len.ptr)
    if (kind === 4) {
      const rc = st.tunnel_decapsulate(tunnel, scratch_slot.ptr, rbuf.ptr, n, rplain.ptr, rplain.length, now, rlen.ptr)
      if (rc === 0) delivered(rplain_i32[0], rlen[0])
      else if (rc !== 1) bad++
    } else if (kind > 0) handle_control(kind, scratch_slot.ptr)
    else control_errors++
  }
}
function on_readable_recv_offload () {
  let n_pub = 0
  while (sc - se < RING) {
    const e = entry(sc)
    const n = net.recv(node.fd, base + e + WIRE, CAP, 0)
    if (n < 0) break
    const now = hrtime()
    const kind = st.interface_receive(iface, peer_ip.ptr, PEER, 0, base + e + WIRE, n, now, base + e + SLOT_MSG,
      tid.ptr, scratch_pub.ptr, out.ptr, out_len.ptr)
    if (kind === 4) {
      u32[lens(sc)] = n
      const rc = st.tunnel_begin_decapsulate(tunnel, base + e + SLOT_MSG, now, base + e + SLOT_DEC)
      if (rc !== 0) { bad++; continue }
      sc++
      n_pub++
    } else if (kind > 0) handle_control(kind, base + e + SLOT_MSG)
    else control_errors++
  }
  if (n_pub) Atomics.store(i32, C_CURSOR_C, sc)
}
// GRO: one recv() returns up to 64 KB of data messages back to back, SEG bytes each
const gro = GSO && !WORKERS ? buf(GRO_BUF) : null
function on_readable_recv_single_gro () {
  for (;;) {
    const n = net.recv(node.fd, gro.ptr, GRO_BUF, 0)
    if (n < 0) return
    const now = hrtime()
    for (let off = 0; off < n; off += SEG) {
      const len = Math.min(SEG, n - off)
      const p = gro.ptr + off
      const kind = st.interface_receive(iface, peer_ip.ptr, PEER, 0, p, len, now, scratch_slot.ptr, tid.ptr,
        scratch_pub.ptr, out.ptr, out_len.ptr)
      if (kind === 4) {
        const rc = st.tunnel_decapsulate(tunnel, scratch_slot.ptr, p, len, rplain.ptr, rplain.length, now, rlen.ptr)
        if (rc === 0) delivered(rplain_i32[0], rlen[0])
        else if (rc !== 1) bad++
      } else if (kind > 0) handle_control(kind, scratch_slot.ptr)
      else control_errors++
    }
  }
}
// GRO with workers: recvmsg() scatters a super-datagram into GSO_MAX consecutive ring entries (SEG bytes each).
// Every segment consumes its entry; non-data or failed segments are marked SKIP for the in-order commit.
const SKIP = 0xffffffff
const rmsg = GSO && WORKERS ? iov_msg(GSO_MAX) : null
function on_readable_recv_offload_gro () {
  const t0 = STATS ? hrtime() : 0
  if (STATS) { stats.readable++; if (RING - (sc - se) < GSO_MAX) stats.ring_full++ }
  let n_pub = 0
  while (RING - (sc - se) >= GSO_MAX) {
    for (let i = 0; i < GSO_MAX; i++) rmsg.set(i, base + entry(sc + i) + WIRE, SEG)
    rmsg.count(GSO_MAX)
    const n = net.recvmsg(node.fd, rmsg.hdr.ptr, 0)
    if (STATS) stats.recv_calls++
    if (n < 0) break
    const now = hrtime()
    if (STATS) stats.segs += Math.ceil(n / SEG)
    for (let off = 0; off < n; off += SEG) {
      const len = Math.min(SEG, n - off)
      const e = entry(sc)
      const l = lens(sc)
      const kind = st.interface_receive(iface, peer_ip.ptr, PEER, 0, base + e + WIRE, len, now, base + e + SLOT_MSG,
        tid.ptr, scratch_pub.ptr, out.ptr, out_len.ptr)
      u32[l + 1] = 0
      if (kind === 4) {
        u32[l] = len
        if (st.tunnel_begin_decapsulate(tunnel, base + e + SLOT_MSG, now, base + e + SLOT_DEC) !== 0) {
          bad++
          u32[l + 1] = SKIP
        }
      } else {
        if (kind > 0) handle_control(kind, base + e + SLOT_MSG)
        else control_errors++
        u32[l + 1] = SKIP
      }
      sc++
      n_pub++
    }
  }
  if (n_pub) Atomics.store(i32, C_CURSOR_C, sc)
  if (STATS) stats.recv_ns += hrtime() - t0
}

function commit_offload (now) {
  const t0 = STATS ? hrtime() : 0
  const before = se
  while (se < sc && ready_d(se)) {
    const e = entry(se)
    const l = lens(se)
    if (GSO && u32[l + 1] === SKIP) { se++; continue } // a non-data GRO segment: nothing to commit
    if (u32[l + 3] !== 0) { bad++; se++; continue }
    const rc = st.tunnel_commit_decapsulate(tunnel, base + e + SLOT_DONE, now, base + e + LENS + 4)
    if (rc === 0) delivered(i32[(e + PLAIN) >> 2], u32[l + 1])
    else if (rc !== 1) bad++
    se++
  }
  if (STATS) { stats.commit_ns += hrtime() - t0; stats.commits += se - before; if (se === before && sc === se) stats.idle_polls++ }
}

function run_recv () {
  const on_readable = GSO
    ? (WORKERS ? on_readable_recv_offload_gro : on_readable_recv_single_gro)
    : (WORKERS ? on_readable_recv_offload : on_readable_recv_single)
  node.bind('127.0.0.1', on_readable, Number(MY_PORT))
  if (GSO) udp_opt(node.fd, UDP_GRO, 1)
  const v = ptr(new Int32Array([32 << 20]))
  net.setsockopt(node.fd, SOL_SOCKET, SO_RCVBUFFORCE, v.ptr, 4)
  assert(node.connect('127.0.0.1', Number(PEER_PORT)) === 0)
  write_text(`${DIR}/recv.ready`, '1\n')
  const start = hrtime()
  for (;;) {
    loop.poll(WORKERS && sc > se ? 0 : 10)
    const now = hrtime()
    if (WORKERS) commit_offload(now)
    timers(now)
    if (got >= TOTAL) break
    if (first ? now - last > 1e9 : now - start > 30e9) break
  }
  write_text(`${DIR}/recv.txt`, `${got} ${last - first} ${bad} ${control_errors}\n`)
  if (STATS) {
    const wd = WORKERS ? new Float64Array(mem.buffer)[(C_DONE_D + 2) >> 1] : 0
    write_text(`${DIR}/recv.stats`, JSON.stringify({ ...stats, window_ns: last - first, worker_decrypt_ns: wd }) + '\n')
  }
}

// ---------------------------------------------------------------------------------------------------------------
// sender
function on_readable_send () { // handshake responses, keepalives, cookie replies
  for (;;) {
    const n = net.recv(node.fd, rbuf.ptr, rbuf.length, 0)
    if (n < 0) return
    const now = hrtime()
    const kind = st.interface_receive(iface, peer_ip.ptr, PEER, 0, rbuf.ptr, n, now, scratch_slot.ptr, tid.ptr,
      scratch_pub.ptr, out.ptr, out_len.ptr)
    if (kind === 4) {
      st.tunnel_decapsulate(tunnel, scratch_slot.ptr, rbuf.ptr, n, rplain.ptr, rplain.length, now, rlen.ptr)
    } else if (kind > 0) handle_control(kind, scratch_slot.ptr)
  }
}

function run_send () {
  node.bind('127.0.0.1', on_readable_send, Number(MY_PORT))
  const v = ptr(new Int32Array([8 << 20]))
  net.setsockopt(node.fd, SOL_SOCKET, SO_SNDBUFFORCE, v.ptr, 4)
  assert(node.connect('127.0.0.1', Number(PEER_PORT)) === 0)
  if (GSO) udp_opt(node.fd, UDP_SEGMENT, SEG)
  wait_for(`${DIR}/recv.ready`)
  // handshake
  let t = hrtime()
  assert(st.tunnel_initiate(tunnel, 0, t, out.ptr, out_len.ptr) === 1)
  send_out()
  while (!established) {
    loop.poll(10)
    drain_events()
    timers(hrtime())
    assert(hrtime() - t < 10e9, 'handshake timed out')
  }
  const pt = buf(SIZE).fill(0x45)
  const pt_i32 = new Int32Array(pt.buffer, 0, 1)
  const wire = buf(CAP)
  const wire_len = ptr(new Uint32Array(1))
  let sent = 0, eagain = 0
  let sa = 0, ss = 0 // offload: next to begin, next to send
  const BATCH = 32
  const gbuf = GSO && !WORKERS ? buf(GSO_MAX * SEG) : null
  const smsg = GSO && WORKERS ? iov_msg(GSO_MAX) : null
  const start = hrtime()
  while (sent < TOTAL) {
    loop.poll(0)
    const now = hrtime()
    if (GSO && !WORKERS) {
      // encrypt k packets back to back at the SEG stride, one send(); the kernel splits it (UDP_SEGMENT)
      const k = Math.min(GSO_MAX, TOTAL - sent)
      for (let i = 0; i < k; i++) {
        pt_i32[0] = sent + i
        const rc = st.tunnel_encapsulate(tunnel, pt.ptr, SIZE, gbuf.ptr + i * SEG, SEG, now, wire_len.ptr)
        if (rc !== 0 || wire_len[0] !== SEG) throw new Error(`encapsulate ${rc} (${wire_len[0]} bytes) at ${sent + i}`)
      }
      while (net.send(node.fd, gbuf.ptr, k * SEG, 0) < 0) { eagain++; loop.poll(0) }
      sent += k
    } else if (!WORKERS) {
      for (let i = 0; i < BATCH && sent < TOTAL; i++) {
        pt_i32[0] = sent
        const rc = st.tunnel_encapsulate(tunnel, pt.ptr, SIZE, wire.ptr, CAP, now, wire_len.ptr)
        if (rc !== 0) throw new Error(`encapsulate ${rc} at ${sent}`)
        while (net.send(node.fd, wire.ptr, wire_len[0], 0) < 0) { eagain++; loop.poll(0) }
        sent++
      }
    } else {
      let n = 0
      while (sa < TOTAL && sa - ss < RING && n < BATCH) {
        const e = entry(sa)
        i32[(e + PT) >> 2] = sa
        const rc = st.tunnel_begin_encapsulate(tunnel, now, base + e + SLOT_ENC)
        if (rc !== 0) throw new Error(`begin_encapsulate ${rc} at ${sa}`)
        sa++
        n++
      }
      if (n) Atomics.store(i32, C_CURSOR_A, sa)
      if (GSO) {
        // one sendmsg() with an iovec over up to GSO_MAX ready entries (SEG bytes each)
        let k = 0
        while (ss + k < sa && k < GSO_MAX && ready_b(ss + k)) {
          const l = lens(ss + k)
          if (u32[l + 2] !== 0) throw new Error(`encrypt failed at ${ss + k}`)
          smsg.set(k, base + entry(ss + k) + WIRE, u32[l])
          k++
        }
        if (k) {
          smsg.count(k)
          if (net.sendmsg(node.fd, smsg.hdr.ptr, 0) < 0) eagain++
          else { ss += k; sent += k }
        }
      }
      while (!GSO && ss < sa && ready_b(ss)) {
        const e = entry(ss)
        const l = lens(ss)
        if (u32[l + 2] !== 0) throw new Error(`encrypt failed at ${ss}`)
        if (net.send(node.fd, base + e + WIRE, u32[l], 0) < 0) { eagain++; break }
        ss++
        sent++
      }
    }
    timers(now)
  }
  const ns = hrtime() - start
  t = hrtime()
  while (hrtime() - t < 200e6) { loop.poll(10); timers(hrtime()) } // answer anything late (keepalives)
  write_text(`${DIR}/send.txt`, `${sent} ${eagain} ${ns}\n`)
}

if (ROLE === 'recv') run_recv()
else run_send()
if (WORKERS) {
  Atomics.store(i32, C_STOP, 1)
  for (const w of workers) { w.waitfor(); w.free() }
}
node.close()
st.tunnel_free(tunnel)
st.interface_free(iface)
