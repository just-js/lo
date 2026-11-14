// Batched IO (sendmmsg/recvmmsg) vs one syscall per packet, for plain UDP and for kernel WireGuard.
// A separate test from bench-wireguard.js (which it copies the kernel-WireGuard set-up from); writes a markdown report.
//
// usage (from repos/lo, as root, full-V8 ./lo):
//   ./lo $PWD/lib/sanstun/bench/bench-wireguard-batch.js [rounds=3] [packets=1000000] [batch=32] [report=lib/sanstun/bench/bench-wireguard-batch.md]
//
// Scenarios, interleaved per round: plain UDP and kernel WireGuard, each unbatched (one send()/recv() per packet,
// as in bench-wireguard.js) and batched (sendmmsg/recvmmsg, up to <batch> packets per call). Same IO otherwise:
// connected non-blocking sockets on lo's epoll loop, drain on readable, EAGAIN -> poll and retry. Inner packets are
// 1,400 B (UDP payload 1,372 B). The kernel-WireGuard sender runs in its own network namespace (core.unshare) behind
// wgclient; the receiver sits behind wgserver. Measured at the receiver: first to last packet, loss = sent - got,
// CPU = all CPUs' busy time from /proc/stat over the run.
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
  if (mode === 'kwg') {
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
  assert(node.connect(mode === 'kwg' ? '10.0.0.1' : '127.0.0.1', PORT) === 0, `connect ${lo.errno}`)
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
    while (sent < total) {
      loop.poll(0)
      for (let i = 0; i < 32 && sent < total; i++) {
        m.i32[0] = sent
        while (net.send(node.fd, m.bufs.ptr, PAYLOAD, 0) < 0) { eagain++; loop.poll(0) }
        sent++
        calls++
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
function receiver (mode, batch) {
  const r = { loop: new Loop(), got: 0, first: 0, last: 0, calls: 0 }
  r.node = new Node(r.loop)
  const m = mmsg(Math.max(1, batch), RBUF)
  const words = RBUF >> 2
  const count = n => {
    if (n !== PAYLOAD) return
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
          if (m.i32[0] >= 0) count(n)
        }
      }
    : () => {
        for (;;) {
          const n = net.recvmmsg(r.node.fd, m.hdrs.ptr, batch, 0, 0)
          r.calls++
          if (n <= 0) return
          for (let i = 0; i < n; i++) {
            if (m.i32[i * words] >= 0) count(m.u32h[(i * MMSG + 56) >> 2]) // msg_len
          }
        }
      }
  r.node.bind('0.0.0.0', on_readable, PORT)
  setsockopt_int(r.node.fd, SO_RCVBUFFORCE, 32 << 20)
  assert(r.node.connect(mode === 'kwg' ? '10.0.0.2' : '127.0.0.1', SRC_PORT) === 0, `connect ${lo.errno}`)
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

async function run (mode, batch, total, lo_bin, self, gso = false) {
  const tmp = `/tmp/bench-wireguard-batch-${core.getpid()}`
  sh(`rm -rf ${tmp} && mkdir -p ${tmp}`)
  if (mode === 'kwg') await kwg_setup()
  const rx = receiver(mode, gso ? 32 : batch)
  const busy0 = cpu_busy_ns()
  const pid = exec_nowait(lo_bin, [self, '--sender', mode, String(batch), String(total), tmp, gso ? 'gso' : ''])
  if (mode === 'kwg') {
    const t = hrtime()
    while (!exists(`${tmp}/ns.ready`)) { core.usleep(1000); assert(hrtime() - t < 10e9, 'sender never unshared') }
    assert(sh(`ip link set wgclient netns ${pid}`) === 0, 'ip link set netns failed')
    write_text(`${tmp}/moved`, '1\n')
  }
  const r = receive(rx, total)
  waitfor(pid)
  const busy = cpu_busy_ns() - busy0
  if (mode === 'kwg') kwg_teardown()
  const report = read_text(`${tmp}/sender.txt`).trim()
  sh(`rm -rf ${tmp}`)
  const [sent, , , scalls] = report.split(' ').map(Number)
  if (!r.got) return { error: `no packets delivered (sender: ${report || 'no report'})` }
  return { ns: (r.last - r.first) / r.got, cpu: busy / r.got, loss: 1 - r.got / (sent || total),
    spc: sent / scalls, rpc: r.got / r.calls }
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
  const batch = Number(lo.args[4] || 32)
  const report_path = lo.args[5] || 'lib/sanstun/bench/bench-wireguard-batch.md'
  const dir = lo.getcwd()
  const self = `${dir}/lib/sanstun/bench/bench-wireguard-batch.js`
  const lo_bin = `${dir}/lo`
  for (const f of [self, lo_bin]) assert(exists(f), `${f} missing: run from repos/lo`)
  assert(typeof net.sendmmsg === 'function' && typeof net.recvmmsg === 'function', 'net has no sendmmsg/recvmmsg')
  const have_wg = typeof core.unshare === 'function' &&
    sh("gzip -dc /proc/config.gz | grep -q '^CONFIG_WIREGUARD=y'") === 0
  const scenarios = [
    { key: 'udp-1', mode: 'udp', batch: 1, icon: '⬜', label: 'plain UDP, one syscall per packet' },
    { key: 'udp-b', mode: 'udp', batch, icon: '⬜', label: `plain UDP, batches of ${batch}` },
    { key: 'udp-g', mode: 'udp', batch: GSO_MAX, gso: true, icon: '⬜', label: `plain UDP, GSO ${GSO_MAX} per send` }
  ]
  if (have_wg) {
    scenarios.push({ key: 'kwg-1', mode: 'kwg', batch: 1, icon: '🟩', label: 'kernel WireGuard, one syscall per packet' })
    scenarios.push({ key: 'kwg-b', mode: 'kwg', batch, icon: '🟩', label: `kernel WireGuard, batches of ${batch}` })
    scenarios.push({ key: 'kwg-g', mode: 'kwg', batch: GSO_MAX, gso: true, icon: '🟩', label: `kernel WireGuard, GSO ${GSO_MAX} per send` })
  }
  const results = Object.fromEntries(scenarios.map(s => [s.key, []]))
  const errors = {}
  const started = new Date()
  kwg_teardown()
  for (let r = 1; r <= rounds; r++) {
    for (const s of scenarios) {
      const t = hrtime()
      const res = await run(s.mode, s.batch, total, lo_bin, self, !!s.gso)
      if (res.error) errors[s.key] = res.error
      else results[s.key].push(res)
      console.log(`round ${r}/${rounds} ${s.label}: ${res.error || `${fmt(res.ns)} ns/packet, CPU ${fmt(res.cpu)} ns/packet, ` +
        `loss ${fmt(res.loss * 100, 1)}%, packets/call send ${fmt(res.spc, 1)} recv ${fmt(res.rpc, 1)}`} (${fmt((hrtime() - t) / 1e9, 1)} s)`)
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
  md.push('# Batched IO (sendmmsg/recvmmsg, GSO) for plain UDP and kernel WireGuard', '')
  md.push(`${started.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${kernel} · ${ncpu} × ${cpu_model} · ` +
    `lo ${lo.version.lo} (V8 ${lo.version.v8}) · ${rounds} rounds × ${fmt(total)} packets of ${fmt(SIZE)} B, medians`, '')
  md.push('Two lo processes on loopback, a sender and a receiver, connected non-blocking sockets on lo\'s epoll loop. ' +
    'Unbatched: one `send`/`recv` per packet. Batched: `sendmmsg`/`recvmmsg` with up to ' + batch + ' packets per ' +
    'call. GSO: one `send` of up to ' + GSO_MAX + ' packets with `UDP_SEGMENT`, split by the kernel (the ' +
    'receiver stays on `recvmmsg`, no UDP GRO). Kernel WireGuard: the sender sits in its own network namespace behind `wgclient`, the receiver behind ' +
    '`wgserver`. Measured at the receiver; CPU is all CPUs\' busy time over the run.', '')
  md.push('| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | packets per call (send / recv) | batched vs unbatched | runs (ns/packet) |')
  md.push('|---|---|---:|---:|---:|---:|---:|---:|---|')
  for (const r of rows) {
    const one = rows.find(x => x.mode === r.mode && x.batch === 1 && !x.gso)
    const vs = r.batch > 1 && one ? `${fmt(one.ns / r.ns, 2)}× faster, ${fmt(one.cpu / r.cpu, 2)}× less CPU` : ''
    md.push(`| ${r.icon} | ${r.label} | ${fmt(r.ns)} | ${fmt(r.gbit, 2)} | ${fmt(r.cpu)} | ${fmt(r.loss * 100, 1)}% | ` +
      `${fmt(r.spc, 1)} / ${fmt(r.rpc, 1)} | ${vs} | ${r.runs || errors[r.key] || ''} |`)
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
    'calls that returned nothing (`EAGAIN`). The receiver only batches when packets are queued by the time it reads.')
  if (Object.keys(errors).length) { md.push('', '## Errors', ''); for (const [k, e] of Object.entries(errors)) md.push(`- ${k}: ${e}`) }
  if (!have_wg) md.push('', '_Kernel WireGuard skipped: needs the wireguard module (CONFIG_WIREGUARD) and `core.unshare`._')
  const text = md.join('\n') + '\n'
  write_text(report_path, text)
  console.log('\n' + text)
  console.log(`report written to ${report_path}`)
}

if (lo.args[2] === '--sender') sender(lo.args[3], Number(lo.args[4]), Number(lo.args[5]), lo.args[6], lo.args[7] === 'gso')
else await main()
