// Fair traffic through three WireGuard implementations, each with a TUN or wg device as the inner side: kernel
// WireGuard, wireguard-go, and lo's sanstun peer (lib/sanstun/tun-peer.js, options gso,vnet,tcpco: outer GSO/GRO,
// coalesced UDP and TCP TUN writes; and stun-ovt, with the TUN read offloads too), plus plain loopback without a tunnel as a reference. The harness of
// bench-wireguard-tun.js (its set-up code is copied unchanged): a lo sender in its own network namespace behind
// wgclient talks to a lo receiver behind wgserver; the encrypted UDP goes over 127.0.0.1. All tunnel devices get
// MTU 1420 (the kernel's and wireguard-go's default), so TCP sees the same MSS everywhere. A separate test.
//
// Tests (instead of bench-wireguard-tun.js's unpaced flood, where every userspace row drops 66-94%):
//   rtt    ping-pong: a 64-byte UDP payload, echoed by the receiver; N round trips one at a time, percentiles
//   paced  UDP at stepped rates (one send of 1,400 B per packet, paced with sleeps): per step the achieved send rate
//          and the loss; the result is the highest achieved rate with loss <= 0.1%
//   tcp    one TCP connection, the sender writes BYTES in 64 KB writes, the receiver reads; goodput and CPU per MB
//
// usage (from repos/lo, as root, full-V8 ./lo):
//   ./lo $PWD/lib/sanstun/bench/bench-wireguard-fair.js [rounds=3] [report=lib/sanstun/bench/bench-wireguard-fair.md]
//   ONLY=plain,kwg,wgo,stun,stun-ovt   implementations (stun-ovt: the peer with TUN read offloads too);   TESTS=rtt,paced,tcp   tests
//   RTT_N=20000  TCP_BYTES=1073741824  PACED_STEPS=0.5,1,1.5,2,2.5,3,3.5,4,5,6 (Gbit/s)  STEP_S=1
import { exec, exec_nowait, waitfor } from 'lib/proc.js'
import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'

const { core, assert, ptr, hrtime } = lo
const enc = new TextEncoder()
const dec = new TextDecoder()

const SIZE = 1400
const PAYLOAD = SIZE - 28
const PORT = 9000, SRC_PORT = 9001, WG_PORT = 8888
const SOL_SOCKET = 1, SO_RCVBUFFORCE = 33, SO_SNDBUFFORCE = 32, SO_RCVTIMEO = 20
const MTU = 1420
const PING = 64
const EAGAIN = 11
const STUN_OPTS = { stun: 'gso,vnet,tcpco', 'stun-ovt': 'gso,vnet,offload,tcpco' }

const exists = path => { const fd = core.open(path, core.O_RDONLY); if (fd < 0) return false; core.close(fd); return true }
const read_text = path => exists(path) ? dec.decode(core.read_file(path)) : ''
// lo's TextEncoder writes U+0080-U+00FF of a one-byte (Latin-1) V8 string as single bytes, not UTF-8 (2026-11-04,
// LO_SANSTUN.md); the report's µ/·/× would come out invalid, so encode here
function utf8 (s) {
  if (!/[\u0080-ÿ]/.test(s)) return enc.encode(s)
  const out = []
  for (const ch of s) {
    const c = ch.codePointAt(0)
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return new Uint8Array(out)
}
const write_text = (path, s) => core.write_file(path, utf8(s))
const sh = cmd => exec('sh', ['-c', cmd])[0]
const proc_buf = ptr(new Uint8Array(65536))
function read_proc (path) { // /proc files report size 0: read until EOF
  const fd = core.open(path, core.O_RDONLY)
  if (fd < 0) return ''
  let s = ''
  for (;;) { const n = core.read(fd, proc_buf.ptr, proc_buf.length); if (n <= 0) break; s += dec.decode(proc_buf.subarray(0, n)) }
  core.close(fd)
  return s
}
function cpu_busy_ns () {
  const [user, nice, system, , , irq, softirq, steal] = read_proc('/proc/stat').split('\n')[0].split(/\s+/).slice(1).map(Number)
  return (user + nice + system + irq + softirq + steal) * 1e7
}
function setsockopt_int (fd, opt, v) {
  const b = ptr(new Int32Array([v]))
  return net.setsockopt(fd, SOL_SOCKET, opt, b.ptr, 4)
}
const sa = (ip, port) => net.types.sockaddr_in(ip, port)
function udp_socket (bind_ip, bind_port, peer_ip, peer_port, nonblock) {
  const fd = net.socket(net.AF_INET, net.SOCK_DGRAM | (nonblock ? net.SOCK_NONBLOCK : 0), 0)
  assert(fd > 2, `socket ${lo.errno}`)
  const b = sa(bind_ip, bind_port)
  assert(net.bind(fd, b.ptr, 16) === 0, `bind ${bind_ip}:${bind_port} ${lo.errno}`)
  const c = sa(peer_ip, peer_port)
  assert(net.connect(fd, c.ptr, 16) === 0, `connect ${peer_ip}:${peer_port} ${lo.errno}`)
  return fd
}
const percentile = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : NaN

// ---------------------------------------------------------------------------------------------------------------
// sender (child process): `--sender <mode> <test> <tmpdir>`; writes <tmpdir>/sender.txt
function sender (mode, test, tmp) {
  if (mode !== 'plain') {
    assert(core.unshare(core.CLONE_NEWNET) === 0, `unshare ${lo.errno}`)
    write_text(`${tmp}/ns.ready`, `${core.getpid()}\n`)
    const t = hrtime()
    while (!exists(`${tmp}/moved`)) { core.usleep(1000); assert(hrtime() - t < 10e9, 'timeout waiting for the device') }
    for (const c of ['ip link set lo up', 'ip addr add 10.0.0.2/32 dev wgclient', 'ip link set wgclient up',
      'ip route add 10.0.0.0/24 dev wgclient']) assert(sh(c) === 0, `${c} failed`)
  }
  const dst = mode === 'plain' ? '127.0.0.1' : '10.0.0.1'
  const src = mode === 'plain' ? '127.0.0.1' : '0.0.0.0'
  if (test === 'rtt') sender_rtt(src, dst, tmp)
  else if (test === 'paced') sender_paced(src, dst, tmp)
  else sender_tcp(dst, tmp)
}

function sender_rtt (src, dst, tmp) {
  const n = Number(lo.getenv('RTT_N') || 20000)
  const fd = udp_socket(src, SRC_PORT, dst, PORT, false)
  const tv = ptr(new BigInt64Array([1n, 0n])) // 1 s receive timeout
  net.setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, tv.ptr, 16)
  const b = ptr(new Uint8Array(2048))
  const i32 = new Int32Array(b.buffer)
  const rtts = new Float64Array(n)
  let got = 0, lost = 0
  // warm-up (handshakes, caches), then n timed round trips, one at a time
  for (let i = -100; i < n; i++) {
    i32[0] = i
    const t0 = hrtime()
    net.send(fd, b.ptr, PING, 0)
    let ok = false
    for (;;) {
      const r = net.recv(fd, b.ptr, 2048, 0)
      if (r < 0) break // timeout
      if (i32[0] === i) { ok = true; break } // ignore a late echo of an earlier ping
    }
    const dt = hrtime() - t0
    if (i < 0) continue
    if (ok) rtts[got++] = dt
    else lost++
  }
  const s = Array.from(rtts.subarray(0, got)).sort((a, b) => a - b)
  const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1)
  write_text(`${tmp}/sender.txt`, JSON.stringify({ n, got, lost, p50: percentile(s, 0.5), p90: percentile(s, 0.9),
    p99: percentile(s, 0.99), p999: percentile(s, 0.999), mean }) + '\n')
  net.close(fd)
}

// paced UDP: per step, packets stamped [seq, step]; pacing by the clock (sleep when more than 60 µs ahead), so each
// step's achieved rate is recorded too (a sender can fall short of the requested rate)
function sender_paced (src, dst, tmp) {
  const steps = (lo.getenv('PACED_STEPS') || '0.5,1,1.5,2,2.5,3,3.5,4,5,6').split(',').map(Number)
  const step_s = Number(lo.getenv('STEP_S') || 1)
  const fd = udp_socket(src, SRC_PORT, dst, PORT, false)
  setsockopt_int(fd, SO_SNDBUFFORCE, 8 << 20)
  const b = ptr(new Uint8Array(2048))
  const i32 = new Int32Array(b.buffer)
  // warm-up: handshakes
  i32[0] = -1; i32[1] = -1
  for (let i = 0; i < 20; i++) { net.send(fd, b.ptr, PAYLOAD, 0); core.usleep(20000) }
  core.usleep(200000)
  const out = []
  let seq = 0
  for (let k = 0; k < steps.length; k++) {
    const pps = steps[k] * 1e9 / 8 / SIZE
    const count = Math.round(pps * step_s)
    const ns_per = 1e9 / pps
    i32[1] = k
    const t0 = hrtime()
    for (let i = 0; i < count; i++) {
      if ((i & 15) === 0) {
        const ahead = t0 + i * ns_per - hrtime()
        if (ahead > 60e3) core.usleep(Math.floor(ahead / 1000))
      }
      i32[0] = seq++
      net.send(fd, b.ptr, PAYLOAD, 0)
    }
    const ns = hrtime() - t0
    out.push({ step: k, rate: steps[k], sent: count, ns })
    core.usleep(300000) // let the tunnel drain before the next step
  }
  write_text(`${tmp}/sender.txt`, JSON.stringify(out) + '\n')
  net.close(fd)
}

function sender_tcp (dst, tmp) {
  const total = Number(lo.getenv('TCP_BYTES') || 1073741824)
  const fd = net.socket(net.AF_INET, net.SOCK_STREAM, 0)
  const c = sa(dst, PORT)
  let rc = -1
  for (let i = 0; i < 50 && rc !== 0; i++) { rc = net.connect(fd, c.ptr, 16); if (rc !== 0) core.usleep(20000) }
  assert(rc === 0, `tcp connect ${lo.errno}`)
  const b = ptr(new Uint8Array(65536))
  let sent = 0
  const t0 = hrtime()
  while (sent < total) {
    const r = net.send(fd, b.ptr, Math.min(65536, total - sent), 0)
    assert(r > 0, `tcp send ${lo.errno}`)
    sent += r
  }
  const ns = hrtime() - t0
  net.shutdown(fd, 1) // SHUT_WR: the receiver sees EOF
  const end = ptr(new Uint8Array(16))
  net.recv(fd, end.ptr, 16, 0) // wait for the receiver to close
  net.close(fd)
  write_text(`${tmp}/sender.txt`, JSON.stringify({ sent, ns }) + '\n')
}

// ---------------------------------------------------------------------------------------------------------------
// receivers (main process, on the epoll loop while the sender runs)
function receiver (mode, test) {
  const loop = new Loop()
  const back = mode === 'plain' ? '127.0.0.1' : '10.0.0.2'
  const r = { loop, fds: [] }
  if (test === 'rtt') {
    const fd = udp_socket(mode === 'plain' ? '127.0.0.1' : '0.0.0.0', PORT, back, SRC_PORT, true)
    const b = ptr(new Uint8Array(2048))
    r.echoed = 0
    loop.add(fd, () => { for (;;) { const n = net.recv(fd, b.ptr, 2048, 0); if (n < 0) return; net.send(fd, b.ptr, n, 0); r.echoed++ } })
    r.fds.push(fd)
  } else if (test === 'paced') {
    const fd = udp_socket(mode === 'plain' ? '127.0.0.1' : '0.0.0.0', PORT, back, SRC_PORT, true)
    setsockopt_int(fd, SO_RCVBUFFORCE, 32 << 20)
    const b = ptr(new Uint8Array(2048))
    const i32 = new Int32Array(b.buffer)
    r.got = new Float64Array(64)
    r.bad = 0
    let prev = -1
    loop.add(fd, () => {
      for (;;) {
        const n = net.recv(fd, b.ptr, 2048, 0)
        if (n < 0) return
        const seq = i32[0], step = i32[1]
        if (seq < 0 || step < 0 || step >= 64) continue
        if (n !== PAYLOAD || seq <= prev) r.bad++
        prev = seq
        r.got[step]++
      }
    })
    r.fds.push(fd)
  } else {
    const lfd = net.socket(net.AF_INET, net.SOCK_STREAM | net.SOCK_NONBLOCK, 0)
    const on = ptr(new Int32Array([1]))
    net.setsockopt(lfd, SOL_SOCKET, 2, on.ptr, 4) // SO_REUSEADDR
    const b = sa(mode === 'plain' ? '127.0.0.1' : '0.0.0.0', PORT)
    assert(net.bind(lfd, b.ptr, 16) === 0, `tcp bind ${lo.errno}`)
    assert(net.listen(lfd, 16) === 0, `listen ${lo.errno}`)
    const rb = ptr(new Uint8Array(262144))
    r.bytes = 0; r.first = 0; r.last = 0; r.done = false
    loop.add(lfd, () => {
      const cfd = net.accept4(lfd, 0, 0, net.SOCK_NONBLOCK)
      if (cfd < 0) return
      r.fds.push(cfd)
      loop.add(cfd, () => {
        for (;;) {
          const n = net.recv(cfd, rb.ptr, rb.length, 0)
          if (n > 0) { const now = hrtime(); if (!r.first) r.first = now; r.last = now; r.bytes += n; continue }
          if (n === 0) { loop.remove(cfd); net.close(cfd); r.fds.splice(r.fds.indexOf(cfd), 1); r.done = true }
          return
        }
      })
    })
    r.fds.push(lfd)
  }
  return r
}

// ---------------------------------------------------------------------------------------------------------------
// kernel WireGuard set-up (as bench-wireguard.js)
async function kwg_setup () {
  const W = await import('lib/wireguard.js')
  const { netlink } = lo.load('netlink')
  const { wireguard, Peer, Device, AllowedIP } = W
  const key = () => ptr(new Uint8Array(32))
  const spriv = key(), spub = key(), cpriv = key(), cpub = key()
  wireguard.genprivKey(spriv.ptr); wireguard.genpubKey(spub.ptr, spriv.ptr)
  wireguard.genprivKey(cpriv.ptr); wireguard.genpubKey(cpub.ptr, cpriv.ptr)
  const keep = []
  function device (name, port, priv, peerPub, allowed, cidr, endpoint) {
    const ip = new AllowedIP()
    ip.family = net.AF_INET
    ip.address4 = allowed
    ip.cidr = cidr
    const peer = new Peer()
    peer.flags = W.WGPEER_HAS_PUBLIC_KEY | W.WGPEER_REPLACE_ALLOWEDIPS
    peer.firstip = ip.ptr
    peer.lastip = ip.ptr
    peer.pubkey.set(peerPub)
    if (endpoint) peer.endpoint = endpoint
    const d = new Device()
    d.name = name
    d.flags = port ? W.WGDEVICE_HAS_PRIVATE_KEY | W.WGDEVICE_HAS_LISTEN_PORT : W.WGDEVICE_HAS_PRIVATE_KEY
    if (port) d.port = port
    d.first = peer.ptr
    d.last = peer.ptr
    d.privkey.set(priv)
    keep.push(ip, peer, d)
    assert(wireguard.add(name) === 0, `wireguard add ${name}: ${lo.errno} (CONFIG_WIREGUARD?)`)
    assert(wireguard.set(d.ptr) === 0, `wireguard set ${name}`)
  }
  device('wgserver', WG_PORT, spriv, cpub, '10.0.0.2', 32)
  device('wgclient', 0, cpriv, spub, '10.0.0.0', 24, { ip: '127.0.0.1', port: WG_PORT })
  const fd = net.socket(net.AF_INET, net.SOCK_DGRAM, 0)
  assert(netlink.set_address(netlink.RTM_NEWADDR, 'wgserver', '10.0.0.1', 24) === 0)
  assert(netlink.device_up(fd, 'wgserver') === 0)
  net.close(fd)
}
const kwg_teardown = () => sh('ip link del wgserver 2>/dev/null; ip link del wgclient 2>/dev/null')

// wireguard-go: two processes, configured over /var/run/wireguard/<name>.sock (UAPI text protocol)
const WGO_BIN = `${lo.getcwd()}/lib/sanstun/bench/wireguard-go`
let wgo_pids = []
const hex = b => Array.from(b, v => v.toString(16).padStart(2, '0')).join('')
function uapi (name, text) {
  const fd = net.socket(net.AF_UNIX, net.SOCK_STREAM, 0)
  const sa = net.types.sockaddr_un(`/var/run/wireguard/${name}.sock`)
  assert(net.connect(fd, sa.ptr, sa.length) === 0, `uapi connect ${name}: ${lo.errno}`)
  const req = ptr(enc.encode(text + '\n'))
  assert(net.send(fd, req.ptr, req.length, 0) === req.length)
  const buf = ptr(new Uint8Array(4096))
  const n = net.recv(fd, buf.ptr, buf.length, 0)
  net.close(fd)
  const reply = n > 0 ? dec.decode(buf.subarray(0, n)) : ''
  assert(reply.includes('errno=0'), `uapi ${name}: ${reply.trim()}`)
}
async function wgo_setup () {
  const W = await import('lib/wireguard.js')
  const { netlink } = lo.load('netlink')
  const { wireguard } = W
  const key = () => ptr(new Uint8Array(32))
  const spriv = key(), spub = key(), cpriv = key(), cpub = key()
  wireguard.genprivKey(spriv.ptr); wireguard.genpubKey(spub.ptr, spriv.ptr)
  wireguard.genprivKey(cpriv.ptr); wireguard.genpubKey(cpub.ptr, cpriv.ptr)
  for (const name of ['wgserver', 'wgclient']) {
    wgo_pids.push(exec_nowait(WGO_BIN, ['-f', name]))
    const t = hrtime()
    // a Unix socket can't be open()ed, so exists() would never see it: access(F_OK)
    while (core.access(`/var/run/wireguard/${name}.sock`, 0) !== 0) { core.usleep(1000); assert(hrtime() - t < 10e9, `wireguard-go ${name} never started`) }
  }
  uapi('wgserver', `set=1\nprivate_key=${hex(spriv)}\nlisten_port=${WG_PORT}\npublic_key=${hex(cpub)}\nallowed_ip=10.0.0.2/32\n`)
  uapi('wgclient', `set=1\nprivate_key=${hex(cpriv)}\nlisten_port=${WG_PORT + 1}\npublic_key=${hex(spub)}\nendpoint=127.0.0.1:${WG_PORT}\nallowed_ip=10.0.0.0/24\n`)
  const fd = net.socket(net.AF_INET, net.SOCK_DGRAM, 0)
  assert(netlink.set_address(netlink.RTM_NEWADDR, 'wgserver', '10.0.0.1', 24) === 0)
  assert(netlink.device_up(fd, 'wgserver') === 0)
  net.close(fd)
}
function wgo_teardown () {
  for (const pid of wgo_pids) sh(`kill -9 ${pid} 2>/dev/null`)
  for (const pid of wgo_pids) waitfor(pid)
  wgo_pids = []
  sh('rm -f /var/run/wireguard/wgserver.sock /var/run/wireguard/wgclient.sock')
}

// sanstun on a TUN: two lib/sanstun/tun-peer.js processes; keys, readiness and counters through files in <tmp>/stun
const STUN_PEER = `${lo.getcwd()}/lib/sanstun/tun-peer.js`
let stun_pids = [], stun_dir = ''
function stun_setup (tmp, lo_bin, opts = '') {
  stun_dir = `${tmp}/stun`
  assert(sh(`mkdir -p ${stun_dir}`) === 0)
  stun_pids.push(exec_nowait(lo_bin, [STUN_PEER, 'wgserver', 'wgclient', String(WG_PORT), String(WG_PORT + 1), stun_dir, 'wait', opts]))
  stun_pids.push(exec_nowait(lo_bin, [STUN_PEER, 'wgclient', 'wgserver', String(WG_PORT + 1), String(WG_PORT), stun_dir, 'init', opts]))
  const t = hrtime()
  for (const f of ['wgserver.ready', 'wgclient.ready', 'wgclient.established']) {
    while (!exists(`${stun_dir}/${f}`)) { core.usleep(1000); assert(hrtime() - t < 10e9, `sanstun peers: no ${f}`) }
  }
  const { netlink } = lo.load('netlink')
  const fd = net.socket(net.AF_INET, net.SOCK_DGRAM, 0)
  assert(netlink.set_address(netlink.RTM_NEWADDR, 'wgserver', '10.0.0.1', 24) === 0)
  assert(netlink.device_up(fd, 'wgserver') === 0)
  net.close(fd)
}
// stop both peers (they poll for <dir>/stop), return their counters; kill -9 by pid only if they don't exit
function stun_teardown () {
  if (!stun_pids.length) return ''
  write_text(`${stun_dir}/stop`, '1\n')
  const t = hrtime()
  let left = stun_pids.slice()
  while (left.length && hrtime() - t < 5e9) {
    left = left.filter(pid => waitfor(pid, true)[1] === 0) // waitpid WNOHANG: 0 = still running
    if (left.length) core.usleep(10000)
  }
  for (const pid of left) { sh(`kill -9 ${pid} 2>/dev/null`); waitfor(pid) }
  stun_pids = []
  // tun_in udp_out udp_in tun_out dropped send_eagain tun_write_errors control_errors tun_win tun_ns udp_win udp_ns
  // udp_send_calls udp_recv_calls tun_writes
  return ['wgclient', 'wgserver'].map(n => `${n}: ${read_text(`${stun_dir}/${n}.txt`).trim() || 'no counters'}${exists(`${stun_dir}/${n}.stats`) ? ` ${read_text(`${stun_dir}/${n}.stats`).trim()}` : ''}`).join('; ')
}

// ---------------------------------------------------------------------------------------------------------------
async function run (mode, test, lo_bin, self) {
  const tmp = `/tmp/bench-wireguard-fair-${core.getpid()}`
  sh(`rm -rf ${tmp} && mkdir -p ${tmp}`)
  if (mode === 'kwg') await kwg_setup()
  if (mode === 'wgo') await wgo_setup()
  if (mode in STUN_OPTS) stun_setup(tmp, lo_bin, STUN_OPTS[mode])
  if (mode !== 'plain') {
    for (const d of ['wgserver', 'wgclient']) assert(sh(`ip link set ${d} mtu ${MTU}`) === 0, `mtu ${d}`)
  }
  const rx = receiver(mode, test)
  const busy0 = cpu_busy_ns()
  const pid = exec_nowait(lo_bin, [self, '--sender', mode, test, tmp])
  if (mode !== 'plain') {
    const t = hrtime()
    while (!exists(`${tmp}/ns.ready`)) { core.usleep(1000); assert(hrtime() - t < 10e9, 'sender never unshared') }
    assert(sh(`ip link set wgclient netns ${pid}`) === 0, 'ip link set netns failed')
    write_text(`${tmp}/moved`, '1\n')
  }
  // pump the receiver until the sender exits (checked every 10 ms), then drain for 200 ms
  const deadline = hrtime() + 600e9
  let next_check = 0
  for (;;) {
    rx.loop.poll(1)
    const now = hrtime()
    if (now >= next_check) {
      if (waitfor(pid, true)[1] !== 0) break
      assert(now < deadline, 'sender ran for more than 10 minutes')
      next_check = now + 10e6
    }
  }
  const drain = hrtime() + 200e6
  while (hrtime() < drain) rx.loop.poll(10)
  const busy = cpu_busy_ns() - busy0
  for (const fd of rx.fds) net.close(fd)
  rx.loop.close()
  if (mode === 'kwg') kwg_teardown()
  if (mode === 'wgo') wgo_teardown()
  const peers = mode in STUN_OPTS ? stun_teardown() : ''
  const report = read_text(`${tmp}/sender.txt`).trim()
  sh(`rm -rf ${tmp}`)
  if (!report) return { error: `sender wrote no report${peers ? `; ${peers}` : ''}` }
  const s = JSON.parse(report)
  if (test === 'rtt') return { ...s, echoed: rx.echoed }
  if (test === 'paced') {
    const steps = s.map(x => ({ ...x, got: rx.got[x.step], loss: 1 - rx.got[x.step] / x.sent, achieved: (x.sent * SIZE * 8) / x.ns }))
    let best = 0
    for (const x of steps) if (x.loss <= 0.001 && x.achieved > best) best = x.achieved
    return { steps, best, bad: rx.bad }
  }
  if (!rx.bytes) return { error: 'no TCP bytes received' }
  return { bytes: rx.bytes, gbit: (rx.bytes * 8) / (rx.last - rx.first), cpu_ns_per_mb: busy / (rx.bytes / 1048576), sent: s.sent }
}

// ---------------------------------------------------------------------------------------------------------------
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN }
function fmt (v, d = 0) { // lo has no Intl
  if (!Number.isFinite(v)) return 'n/a'
  const [i, f] = Math.abs(v).toFixed(d).split('.')
  return (v < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '')
}
const us = ns => fmt(ns / 1000, 1)

async function main () {
  const rounds = Number(lo.args[2] || 3)
  const report_path = lo.args[3] || 'lib/sanstun/bench/bench-wireguard-fair.md'
  const dir = lo.getcwd()
  const self = `${dir}/lib/sanstun/bench/bench-wireguard-fair.js`
  const lo_bin = `${dir}/lo`
  for (const f of [self, lo_bin, WGO_BIN, STUN_PEER]) assert(exists(f), `${f} missing: run from repos/lo`)
  const have_wg = typeof core.unshare === 'function' && sh("gzip -dc /proc/config.gz | grep -q '^CONFIG_WIREGUARD=y'") === 0
  const all_modes = [['plain', 'plain loopback, no tunnel (reference)'], ['kwg', 'kernel WireGuard'],
    ['wgo', 'wireguard-go'], ['stun', `lo + sanstun on TUN (${STUN_OPTS.stun})`],
    ['stun-ovt', `lo + sanstun on TUN (${STUN_OPTS['stun-ovt']})`]]
  const only = (lo.getenv('ONLY') || '').split(',').filter(Boolean)
  const modes = all_modes.filter(([m]) => (!only.length || only.includes(m)) && (m !== 'kwg' || have_wg))
  const tests = (lo.getenv('TESTS') || 'rtt,paced,tcp').split(',').filter(Boolean)
  const results = {}
  const errors = []
  const started = new Date()
  kwg_teardown()
  sh('rm -f /var/run/wireguard/wgserver.sock /var/run/wireguard/wgclient.sock')
  for (let r = 1; r <= rounds; r++) {
    for (const test of tests) {
      for (const [mode, label] of modes) {
        const t = hrtime()
        let res
        try { res = await run(mode, test, lo_bin, self) } catch (err) { res = { error: err.message }; kwg_teardown(); wgo_teardown(); stun_teardown() }
        const key = `${test}:${mode}`
        if (res.error) errors.push(`round ${r} ${key}: ${res.error}`)
        else (results[key] ||= []).push(res)
        let line = res.error || ''
        if (!res.error && test === 'rtt') line = `p50 ${us(res.p50)} us, p99 ${us(res.p99)} us, mean ${us(res.mean)} us, lost ${res.lost}`
        if (!res.error && test === 'paced') line = `best loss-free ${fmt(res.best, 2)} Gbit/s, bad ${res.bad}; ` +
          res.steps.map(x => `${fmt(x.achieved, 2)}:${fmt(x.loss * 100, 2)}%`).join(' ')
        if (!res.error && test === 'tcp') line = `${fmt(res.gbit, 2)} Gbit/s, CPU ${fmt(res.cpu_ns_per_mb / 1000)} us/MB`
        console.log(`round ${r}/${rounds} ${test} ${label}: ${line} (${fmt((hrtime() - t) / 1e9, 1)} s)`)
      }
    }
  }
  const kernel = read_proc('/proc/version').split(' ').slice(0, 3).join(' ')
  const cpu_model = (read_proc('/proc/cpuinfo').match(/model name\s*:\s*(.*)/) || [])[1] || 'unknown'
  const ncpu = (read_proc('/proc/cpuinfo').match(/^processor/gm) || []).length
  const poll = read_proc('/sys/module/haltpoll/parameters/guest_halt_poll_ns').trim() || 'n/a'
  const md = ['# Fair traffic: kernel WireGuard vs wireguard-go vs lo + sanstun on TUN', '',
    `${started.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${kernel} · ${ncpu} × ${cpu_model} · ` +
    `lo ${lo.version.lo} (V8 ${lo.version.v8}) · guest_halt_poll_ns ${poll} · ${rounds} rounds, medians`, '',
    'A lo sender in its own network namespace behind `wgclient`, a lo receiver behind `wgserver`, the encrypted UDP ' +
    `over 127.0.0.1; every tunnel device at MTU ${MTU}. "plain" is the same sender and receiver over loopback without ` +
    'a tunnel or namespace.', '']
  if (tests.includes('rtt')) {
    md.push(`## Round-trip time (ping-pong, ${PING} B UDP payload, ${fmt(Number(lo.getenv('RTT_N') || 20000))} round trips)`, '',
      '| implementation | p50 µs | p90 µs | p99 µs | p99.9 µs | mean µs | lost |', '|---|---:|---:|---:|---:|---:|---:|')
    for (const [mode, label] of modes) {
      const rs = results[`rtt:${mode}`] || []
      md.push(`| ${label} | ${us(median(rs.map(x => x.p50)))} | ${us(median(rs.map(x => x.p90)))} | ${us(median(rs.map(x => x.p99)))} | ` +
        `${us(median(rs.map(x => x.p999)))} | ${us(median(rs.map(x => x.mean)))} | ${fmt(median(rs.map(x => x.lost)))} |`)
    }
    md.push('')
  }
  if (tests.includes('paced')) {
    md.push('## Paced UDP (1,400 B packets, one `send` each; highest achieved rate with loss <= 0.1%)', '',
      '| implementation | loss-free Gbit/s (median) | runs | loss per step (median, achieved Gbit/s: loss) |', '|---|---:|---|---|')
    for (const [mode, label] of modes) {
      const rs = results[`paced:${mode}`] || []
      const nsteps = rs.length ? rs[0].steps.length : 0
      const per = []
      for (let k = 0; k < nsteps; k++) {
        per.push(`${fmt(median(rs.map(x => x.steps[k].achieved)), 2)}: ${fmt(median(rs.map(x => x.steps[k].loss)) * 100, 2)}%`)
      }
      md.push(`| ${label} | ${fmt(median(rs.map(x => x.best)), 2)} | ${rs.map(x => fmt(x.best, 2)).join(' / ')} | ${per.join(' · ')} |`)
    }
    md.push('')
  }
  if (tests.includes('tcp')) {
    md.push(`## TCP (one connection, ${fmt(Number(lo.getenv('TCP_BYTES') || 1073741824) / 1048576)} MB in 64 KB writes)`, '',
      '| implementation | Gbit/s (median) | runs | CPU µs per MB, all CPUs |', '|---|---:|---|---:|')
    for (const [mode, label] of modes) {
      const rs = results[`tcp:${mode}`] || []
      md.push(`| ${label} | ${fmt(median(rs.map(x => x.gbit)), 2)} | ${rs.map(x => fmt(x.gbit, 2)).join(' / ')} | ` +
        `${fmt(median(rs.map(x => x.cpu_ns_per_mb)) / 1000)} |`)
    }
    md.push('')
  }
  if (errors.length) md.push('## Errors', '', ...errors.map(e => `- ${e}`), '')
  if (!have_wg) md.push('_Kernel WireGuard skipped: needs CONFIG_WIREGUARD and `core.unshare`._', '')
  const text = md.join('\n')
  write_text(report_path, text)
  console.log('\n' + text)
  console.log(`report written to ${report_path}`)
}

if (lo.args[2] === '--sender') sender(lo.args[3], lo.args[4], lo.args[5])
else await main()
