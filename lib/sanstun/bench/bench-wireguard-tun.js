// sanstun on a TUN (lib/sanstun/tun-peer.js) vs wireguard-go vs kernel WireGuard, all three with a TUN or wg device
// as the inner side and the same harness (bench-wireguard-go.js's): a lo sender in its own network namespace behind
// wgclient sends inner UDP to a lo receiver behind wgserver; the encrypted UDP goes over 127.0.0.1 in the main
// namespace. wireguard-go and the sanstun peers run as two processes each (TUN + UDP), and their wgclient TUN is moved
// into the sender's namespace like the kernel device. Rows: one syscall per packet, and GSO sender + UDP_GRO
// receiver (the inner traffic; the sanstun peers themselves are one packet per syscall so far). A separate test.
//
// usage (from repos/lo, as root, full-V8 ./lo):
//   ./lo $PWD/lib/sanstun/bench/bench-wireguard-tun.js [rounds=3] [packets=1000000] [report=lib/sanstun/bench/bench-wireguard-tun.md]
//   ONLY=stun-1,stun-gg ...  runs only those scenarios (keys: kwg-1 kwg-gg wgo-1 wgo-gg, and stun[-o|-ov]-1/-gg:
//   sanstun peers plain, with outer GSO/GRO (-o), with outer GSO/GRO + coalesced TUN writes (-ov), and with the TUN
//   read side too (-ovt: TUNSETOFFLOAD, super-packets split in the peer, and TCP coalescing on write))
import { exec, exec_nowait, waitfor } from 'lib/proc.js'
import { net } from 'lib/net.js'
import { Node } from 'lib/udp.js'
import { Loop } from 'lib/loop.js'

const { core, assert, ptr, hrtime } = lo
const enc = new TextEncoder()
const dec = new TextDecoder()

const SIZE = 1400
const PAYLOAD = SIZE - 28
const PORT = 9000, SRC_PORT = 9001, WG_PORT = 8888
const SOL_SOCKET = 1, SO_RCVBUFFORCE = 33, SO_SNDBUFFORCE = 32
const SOL_UDP = 17, UDP_SEGMENT = 103 // GSO: the kernel splits one send() into gso_size datagrams
const GSO_MAX = Math.floor(65507 / PAYLOAD) // segments per send that fit one UDP send (47)
const MMSG = 64 // sizeof(struct mmsghdr) on 64-bit Linux: msghdr (56) + msg_len (4) + padding
const RBUF = 2048
const UDP_GRO = 104 // the socket receives coalesced super-datagrams (segments of the sender's gso_size)
const GRO_BUF = 65536

const exists = path => { const fd = core.open(path, core.O_RDONLY); if (fd < 0) return false; core.close(fd); return true }
const read_text = path => exists(path) ? dec.decode(core.read_file(path)) : ''
const write_text = (path, s) => core.write_file(path, enc.encode(s))
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

// n mmsghdrs, each with one iovec over its own buffer of `size` bytes
function mmsg (n, size) {
  const hdrs = ptr(new Uint8Array(MMSG * n))
  const iovs = ptr(new Uint8Array(16 * n))
  const bufs = ptr(new Uint8Array(size * n))
  const hv = new DataView(hdrs.buffer)
  const iv = new DataView(iovs.buffer)
  for (let i = 0; i < n; i++) {
    iv.setBigUint64(i * 16, BigInt(bufs.ptr + i * size), true)
    iv.setBigUint64(i * 16 + 8, BigInt(size), true)
    hv.setBigUint64(i * MMSG + 16, BigInt(iovs.ptr + i * 16), true) // msg_iov
    hv.setBigUint64(i * MMSG + 24, 1n, true) // msg_iovlen
  }
  return { hdrs, bufs, hv, n, size, i32: new Int32Array(bufs.buffer), u32h: new Uint32Array(hdrs.buffer) }
}

// ---------------------------------------------------------------------------------------------------------------
// sender (child process): `--sender <udp|kwg> <batch> <packets> <tmpdir> [gso]`
// gso: one send() of up to <batch> packets (max GSO_MAX) with UDP_SEGMENT = PAYLOAD
function sender (mode, batch, total, tmp, gso) {
  if (mode !== 'udp') {
    assert(core.unshare(core.CLONE_NEWNET) === 0, `unshare ${lo.errno}`)
    write_text(`${tmp}/ns.ready`, `${core.getpid()}\n`)
    const t = hrtime()
    while (!exists(`${tmp}/moved`)) { core.usleep(1000); assert(hrtime() - t < 10e9, 'timeout waiting for the device') }
    for (const c of ['ip link set lo up', 'ip addr add 10.0.0.2/32 dev wgclient', 'ip link set wgclient up',
      'ip route add 10.0.0.0/24 dev wgclient']) assert(sh(c) === 0, `${c} failed`)
  }
  const loop = new Loop()
  const node = new Node(loop)
  const drop = ptr(new Uint8Array(RBUF))
  node.bind('0.0.0.0', () => { while (net.recv(node.fd, drop.ptr, drop.length, 0) >= 0) {} }, SRC_PORT)
  setsockopt_int(node.fd, SO_SNDBUFFORCE, 8 << 20)
  assert(node.connect(mode !== 'udp' ? '10.0.0.1' : '127.0.0.1', PORT) === 0, `connect ${lo.errno}`)
  if (gso) {
    const v = ptr(new Int32Array([PAYLOAD]))
    assert(net.setsockopt(node.fd, SOL_UDP, UDP_SEGMENT, v.ptr, 4) === 0, `UDP_SEGMENT ${lo.errno}`)
    batch = Math.min(batch, GSO_MAX)
  }
  const m = mmsg(Math.max(1, batch), PAYLOAD)
  const words = PAYLOAD >> 2
  // warm-up: lets kernel WireGuard complete its handshake
  m.i32[0] = -1
  for (let i = 0; i < 20; i++) { net.send(node.fd, m.bufs.ptr, PAYLOAD, 0); core.usleep(20000) }
  core.usleep(200000)
  let sent = 0, eagain = 0, calls = 0
  const t0 = hrtime()
  if (gso) {
    // the buffers of m are contiguous: segment i is at i * PAYLOAD
    while (sent < total) {
      loop.poll(0)
      const k = Math.min(batch, total - sent)
      for (let i = 0; i < k; i++) m.i32[i * words] = sent + i
      while (net.send(node.fd, m.bufs.ptr, k * PAYLOAD, 0) < 0) { eagain++; loop.poll(0) }
      calls++
      sent += k
    }
  } else if (batch <= 1) {
    // PACE_N / PACE_US (diagnostics): sleep PACE_US after every PACE_N packets
    const pace_n = Number(lo.getenv('PACE_N') || 0), pace_us = Number(lo.getenv('PACE_US') || 0)
    while (sent < total) {
      loop.poll(0)
      for (let i = 0; i < 32 && sent < total; i++) {
        m.i32[0] = sent
        while (net.send(node.fd, m.bufs.ptr, PAYLOAD, 0) < 0) { eagain++; loop.poll(0) }
        sent++
        calls++
        if (pace_n && sent % pace_n === 0) core.usleep(pace_us)
      }
    }
  } else {
    while (sent < total) {
      loop.poll(0)
      const k = Math.min(batch, total - sent)
      for (let i = 0; i < k; i++) m.i32[i * words] = sent + i
      let done = 0
      while (done < k) {
        const r = net.sendmmsg(node.fd, m.hdrs.ptr + done * MMSG, k - done, 0)
        calls++
        if (r < 0) { eagain++; loop.poll(0); continue }
        done += r
      }
      sent += k
    }
  }
  const ns = hrtime() - t0
  node.close()
  write_text(`${tmp}/sender.txt`, `${sent} ${eagain} ${ns} ${calls}\n`)
}

// receiver: drains on readable, one recv() per packet or recvmmsg() per batch
function receiver (mode, batch, gro) {
  // bad: a sequence number that doesn't increase (reorder/duplicate) or a datagram of the wrong size
  const r = { loop: new Loop(), got: 0, first: 0, last: 0, calls: 0, prev: -1, bad: 0 }
  const seq = v => { if (v <= r.prev) r.bad++; r.prev = v }
  r.node = new Node(r.loop)
  if (gro) {
    // one recv() returns a super-datagram of up to 64 KB: the sender's 1,372-byte segments back to back
    const big = ptr(new Uint8Array(GRO_BUF))
    const bw = new Int32Array(big.buffer)
    const words = PAYLOAD >> 2
    r.node.bind('0.0.0.0', () => {
      for (;;) {
        const n = net.recv(r.node.fd, big.ptr, GRO_BUF, 0)
        r.calls++
        if (n < 0) return
        const segs = Math.ceil(n / PAYLOAD)
        if (n % PAYLOAD) r.bad++
        const now = hrtime()
        for (let i = 0; i < segs; i++) {
          if (bw[i * words] < 0) continue
          seq(bw[i * words])
          if (!r.first) r.first = now
          r.last = now
          r.got++
        }
      }
    }, PORT)
    const one = ptr(new Int32Array([1]))
    assert(net.setsockopt(r.node.fd, SOL_UDP, UDP_GRO, one.ptr, 4) === 0, `UDP_GRO ${lo.errno}`)
    setsockopt_int(r.node.fd, SO_RCVBUFFORCE, 32 << 20)
    assert(r.node.connect(mode !== 'udp' ? '10.0.0.2' : '127.0.0.1', SRC_PORT) === 0, `connect ${lo.errno}`)
    return r
  }
  const m = mmsg(Math.max(1, batch), RBUF)
  const words = RBUF >> 2
  const count = (n, v) => {
    if (n !== PAYLOAD) { r.bad++; return }
    seq(v)
    const now = hrtime()
    if (!r.first) r.first = now
    r.last = now
    r.got++
  }
  const on_readable = batch <= 1
    ? () => {
        for (;;) {
          const n = net.recv(r.node.fd, m.bufs.ptr, RBUF, 0)
          r.calls++
          if (n < 0) return
          if (m.i32[0] >= 0) count(n, m.i32[0])
        }
      }
    : () => {
        for (;;) {
          const n = net.recvmmsg(r.node.fd, m.hdrs.ptr, batch, 0, 0)
          r.calls++
          if (n <= 0) return
          for (let i = 0; i < n; i++) {
            if (m.i32[i * words] >= 0) count(m.u32h[(i * MMSG + 56) >> 2], m.i32[i * words]) // msg_len
          }
        }
      }
  r.node.bind('0.0.0.0', on_readable, PORT)
  setsockopt_int(r.node.fd, SO_RCVBUFFORCE, 32 << 20)
  assert(r.node.connect(mode !== 'udp' ? '10.0.0.2' : '127.0.0.1', SRC_PORT) === 0, `connect ${lo.errno}`)
  return r
}
function receive (r, total) {
  const start = hrtime()
  for (;;) {
    r.loop.poll(10)
    const now = hrtime()
    if (r.got >= total) break
    if (r.first ? now - r.last > 1e9 : now - start > 30e9) break
  }
  r.node.close()
  r.loop.close()
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

async function run (mode, batch, total, lo_bin, self, gso = false, peer_opts = '') {
  const tmp = `/tmp/bench-wireguard-tun-${core.getpid()}`
  sh(`rm -rf ${tmp} && mkdir -p ${tmp}`)
  if (mode === 'kwg') await kwg_setup()
  if (mode === 'wgo') await wgo_setup()
  if (mode === 'stun') stun_setup(tmp, lo_bin, peer_opts)
  const rx = receiver(mode, gso ? 32 : 1, gso)
  const busy0 = cpu_busy_ns()
  const pid = exec_nowait(lo_bin, [self, '--sender', mode, String(batch), String(total), tmp, gso ? 'gso' : ''])
  if (mode !== 'udp') {
    const t = hrtime()
    while (!exists(`${tmp}/ns.ready`)) { core.usleep(1000); assert(hrtime() - t < 10e9, 'sender never unshared') }
    assert(sh(`ip link set wgclient netns ${pid}`) === 0, 'ip link set netns failed')
    write_text(`${tmp}/moved`, '1\n')
  }
  const r = receive(rx, total)
  waitfor(pid)
  const busy = cpu_busy_ns() - busy0
  if (mode === 'kwg') kwg_teardown()
  if (mode === 'wgo') wgo_teardown()
  const peers = mode === 'stun' ? stun_teardown() : ''
  const report = read_text(`${tmp}/sender.txt`).trim()
  sh(`rm -rf ${tmp}`)
  const [sent, , , scalls] = report.split(' ').map(Number)
  if (!r.got) return { error: `no packets delivered (sender: ${report || 'no report'}${peers ? `; ${peers}` : ''})` }
  return { ns: (r.last - r.first) / r.got, cpu: busy / r.got, loss: 1 - r.got / (sent || total),
    spc: sent / scalls, rpc: r.got / r.calls, bad: r.bad, peers }
}

// ---------------------------------------------------------------------------------------------------------------
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN }
function fmt (v, d = 0) { // lo has no Intl
  if (!Number.isFinite(v)) return 'n/a'
  const [i, f] = Math.abs(v).toFixed(d).split('.')
  return (v < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '')
}
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
function bar (v, max, width = 36) {
  if (!Number.isFinite(v) || v <= 0) return ''
  const cells = (v / max) * width
  const full = Math.floor(cells)
  return '█'.repeat(full) + EIGHTHS[Math.floor((cells - full) * 8)]
}

async function main () {
  const rounds = Number(lo.args[2] || 3)
  const total = Number(lo.args[3] || 1000000)
  const batch = GSO_MAX
  const report_path = lo.args[4] || 'lib/sanstun/bench/bench-wireguard-tun.md'
  const dir = lo.getcwd()
  const self = `${dir}/lib/sanstun/bench/bench-wireguard-tun.js`
  const lo_bin = `${dir}/lo`
  for (const f of [self, lo_bin]) assert(exists(f), `${f} missing: run from repos/lo`)
  assert(typeof net.sendmmsg === 'function' && typeof net.recvmmsg === 'function', 'net has no sendmmsg/recvmmsg')
  const have_wg = typeof core.unshare === 'function' &&
    sh("gzip -dc /proc/config.gz | grep -q '^CONFIG_WIREGUARD=y'") === 0
  assert(exists(WGO_BIN), `${WGO_BIN} missing (build wireguard-go, see LO_SANSTUN.md)`)
  const scenarios = []
  if (have_wg) {
    scenarios.push({ key: 'kwg-1', mode: 'kwg', batch: 1, icon: '🟩', label: 'kernel WireGuard, one syscall per packet' })
    scenarios.push({ key: 'kwg-gg', mode: 'kwg', batch: GSO_MAX, gso: true, icon: '🟩', label: `kernel WireGuard, GSO ${GSO_MAX} + GRO` })
  }
  scenarios.push({ key: 'wgo-1', mode: 'wgo', batch: 1, icon: '🟨', label: 'wireguard-go, one syscall per packet' })
  scenarios.push({ key: 'wgo-gg', mode: 'wgo', batch: GSO_MAX, gso: true, icon: '🟨', label: `wireguard-go, GSO ${GSO_MAX} + GRO` })
  for (const [suffix, opts, what] of [['', '', ''], ['-o', 'gso', ' + outer GSO/GRO'], ['-ov', 'gso,vnet', ' + outer GSO/GRO + coalesced TUN writes'],
    ['-ovt', 'gso,vnet,offload,tcpco', ' + outer GSO/GRO + coalesced TUN writes + TUN read offloads']]) {
    scenarios.push({ key: `stun${suffix}-1`, mode: 'stun', opts, batch: 1, icon: '🟦', label: `sanstun on TUN${what}, one syscall per packet` })
    scenarios.push({ key: `stun${suffix}-gg`, mode: 'stun', opts, batch: GSO_MAX, gso: true, icon: '🟦', label: `sanstun on TUN${what}, GSO ${GSO_MAX} + GRO` })
  }
  const only = (lo.getenv('ONLY') || '').split(',').filter(Boolean)
  if (only.length) scenarios.splice(0, scenarios.length, ...scenarios.filter(s => only.includes(s.key)))
  assert(scenarios.length, `no scenarios (ONLY=${only.join(',')})`)
  assert(exists(STUN_PEER), `${STUN_PEER} missing`)
  const results = Object.fromEntries(scenarios.map(s => [s.key, []]))
  const errors = {}
  const started = new Date()
  kwg_teardown()
  sh('rm -f /var/run/wireguard/wgserver.sock /var/run/wireguard/wgclient.sock')
  for (let r = 1; r <= rounds; r++) {
    for (const s of scenarios) {
      const t = hrtime()
      let res
      try { res = await run(s.mode, s.batch, total, lo_bin, self, !!s.gso, s.opts || '') } catch (err) { res = { error: err.message }; kwg_teardown(); wgo_teardown(); stun_teardown() }
      if (res.error) errors[s.key] = res.error
      else results[s.key].push(res)
      console.log(`round ${r}/${rounds} ${s.label}: ${res.error || `${fmt(res.ns)} ns/packet, CPU ${fmt(res.cpu)} ns/packet, ` +
        `loss ${fmt(res.loss * 100, 1)}%, packets/call send ${fmt(res.spc, 1)} recv ${fmt(res.rpc, 1)}, bad ${res.bad}${res.peers ? `; peers ${res.peers}` : ''}`} (${fmt((hrtime() - t) / 1e9, 1)} s)`)
    }
  }
  const rows = scenarios.map(s => {
    const rs = results[s.key]
    const ns = median(rs.map(x => x.ns))
    return { ...s, ns, gbit: (SIZE * 8) / ns, cpu: median(rs.map(x => x.cpu)), loss: median(rs.map(x => x.loss)),
      spc: median(rs.map(x => x.spc)), rpc: median(rs.map(x => x.rpc)), runs: rs.map(x => fmt(x.ns)).join(' / ') }
  })
  const kernel = read_proc('/proc/version').split(' ').slice(0, 3).join(' ')
  const cpu_model = (read_proc('/proc/cpuinfo').match(/model name\s*:\s*(.*)/) || [])[1] || 'unknown'
  const ncpu = (read_proc('/proc/cpuinfo').match(/^processor/gm) || []).length
  const md = []
  md.push('# sanstun on a TUN vs wireguard-go vs kernel WireGuard', '')
  md.push(`${started.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${kernel} · ${ncpu} × ${cpu_model} · ` +
    `lo ${lo.version.lo} (V8 ${lo.version.v8}) · ${rounds} rounds × ${fmt(total)} packets of ${fmt(SIZE)} B, medians`, '')
  md.push('Two lo processes: a sender in its own network namespace behind `wgclient` and a receiver behind `wgserver`; ' +
    'the encrypted UDP goes over 127.0.0.1. Kernel WireGuard: wg devices. wireguard-go: two processes (TUN + UDP ' +
    'each), configured over UAPI. sanstun: two `lib/sanstun/tun-peer.js` processes (TUN + UDP each, one packet per ' +
    'syscall on both sides, or batched: outer GSO/GRO, and coalesced `IFF_VNET_HDR` TUN writes). The userspace peers\' `wgclient` TUN is moved into the sender\'s namespace. Rows: one `send`/`recv` per ' +
    'packet, and a GSO sender (' + GSO_MAX + ' packets per `UDP_SEGMENT` send) with a `UDP_GRO` receiver. Measured at ' +
    'the receiver; CPU is all CPUs\' busy time (includes the peer processes).', '')
  md.push('| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | packets per call (send / recv) | runs (ns/packet) |')
  md.push('|---|---|---:|---:|---:|---:|---:|---|')
  for (const r of rows) {
    md.push(`| ${r.icon} | ${r.label} | ${fmt(r.ns)} | ${fmt(r.gbit, 2)} | ${fmt(r.cpu)} | ${fmt(r.loss * 100, 1)}% | ` +
      `${fmt(r.spc, 1)} / ${fmt(r.rpc, 1)} | ${r.runs || errors[r.key] || ''} |`)
  }
  const width = Math.max(...rows.map(r => r.label.length))
  const max_gbit = Math.max(...rows.map(r => r.gbit).filter(Number.isFinite))
  const max_cpu = Math.max(...rows.map(r => r.cpu).filter(Number.isFinite))
  md.push('', '**Throughput** (Gbit/s of inner packets, higher is better)', '', '```')
  for (const r of rows) md.push(`${r.icon} ${r.label.padEnd(width)} ${bar(r.gbit, max_gbit).padEnd(37)} ${fmt(r.gbit, 2)}`)
  md.push('```', '', '**CPU time per packet**, all CPUs (ns, lower is better)', '', '```')
  for (const r of rows) md.push(`${r.icon} ${r.label.padEnd(width)} ${bar(r.cpu, max_cpu).padEnd(37)} ${fmt(r.cpu)}`)
  md.push('```', '')
  md.push('- "packets per call" is what each `sendmmsg`/`recvmmsg` (or `send`/`recv`) actually moved, including the ' +
    'calls that returned nothing (`EAGAIN`): on the receiver, packets per `recv` of a GRO super-datagram.')
  if (Object.keys(errors).length) { md.push('', '## Errors', ''); for (const [k, e] of Object.entries(errors)) md.push(`- ${k}: ${e}`) }
  if (!have_wg) md.push('', '_Kernel WireGuard skipped: needs the wireguard module (CONFIG_WIREGUARD) and `core.unshare`._')
  const text = md.join('\n') + '\n'
  write_text(report_path, text)
  console.log('\n' + text)
  console.log(`report written to ${report_path}`)
}

if (lo.args[2] === '--sender') sender(lo.args[3], Number(lo.args[4]), Number(lo.args[5]), lo.args[6], lo.args[7] === 'gso')
else await main()
