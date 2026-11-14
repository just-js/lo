// WireGuard benchmark: sanstun in lo and in Rust (single thread and with crypto offload), kernel WireGuard driven
// from lo, and plain UDP as the IO baseline. Writes a markdown report.
//
// usage (from repos/lo, as root, full-V8 ./lo):
//   ./lo $PWD/lib/sanstun/bench/bench-wireguard.js [rounds=3] [packets=1000000] [workers=3] [report=lib/sanstun/bench/bench-wireguard.md]
//
// What each scenario measures (inner packets of SIZE = 1,400 bytes everywhere):
// - "lo/rust, N workers": lib/sanstun/offload.js and lib/sanstun/bench/sanstun-offload, the whole a -> b path in one
//   process with no IO: encapsulate, receive, decapsulate, commit, every packet checked. 0 workers = single thread.
// - "lo + kernel WireGuard": real UDP. A lo sender in its own network namespace (core.unshare) sends through
//   wgclient; the encrypted UDP leaves through wgclient's socket, which stays in the main namespace (WireGuard keeps
//   the socket where the device was created), and reaches wgserver, whose lo receiver counts the packets. The kernel
//   encrypts and decrypts on all CPUs.
// - "plain UDP": the same sender and receiver over 127.0.0.1 without WireGuard, the IO ceiling for the row above.
// - "lo sanstun peers": lib/sanstun/peer.js, a userspace WireGuard peer per process over UDP. All three network
//   scenarios use the same IO: connected non-blocking sockets on lo's epoll loop, one send()/recv() per packet.
// Per scenario: wall ns per packet (delivered), Gbit/s of inner packets, and CPU ns per packet: busy time of all
// CPUs from /proc/stat over the run, divided by packets (includes process start-up; ~1-3% at 1M packets).
// Rounds are interleaved; the report shows medians.
import { exec, exec_nowait, waitfor } from 'lib/proc.js'
import { net } from 'lib/net.js'
import { Node } from 'lib/udp.js'
import { Loop } from 'lib/loop.js'

const { core, assert, ptr, hrtime } = lo
const enc = new TextEncoder()
const dec = new TextDecoder()

const SIZE = 1400 // inner packet
const PAYLOAD = SIZE - 28 // UDP payload inside the tunnel: + 20 IP + 8 UDP = SIZE
const PORT = 9000
const SRC_PORT = 9001
const WG_PORT = 8888
const SOL_SOCKET = 1, SO_RCVBUF = 8, SO_SNDBUF = 7, SO_RCVTIMEO = 20, SO_RCVBUFFORCE = 33, SO_SNDBUFFORCE = 32

const exists = path => {
  const fd = core.open(path, core.O_RDONLY)
  if (fd < 0) return false
  core.close(fd)
  return true
}
const read_text = path => exists(path) ? dec.decode(core.read_file(path)) : ''
// /proc files report size 0, so core.read_file returns nothing for them: read until EOF
const proc_buf = ptr(new Uint8Array(65536))
function read_proc (path) {
  const fd = core.open(path, core.O_RDONLY)
  if (fd < 0) return ''
  let s = ''
  for (;;) {
    const n = core.read(fd, proc_buf.ptr, proc_buf.length)
    if (n <= 0) break
    s += dec.decode(proc_buf.subarray(0, n))
  }
  core.close(fd)
  return s
}
const write_text = (path, s) => core.write_file(path, enc.encode(s))
const sh = cmd => exec('sh', ['-c', cmd])[0]
const sh_out = (cmd, file) => { const rc = sh(`${cmd} > ${file} 2>&1`); return { rc, out: read_text(file) } }

// busy jiffies of all CPUs (user nice system irq softirq steal), USER_HZ 100
function cpu_busy_ns () {
  const line = read_proc('/proc/stat').split('\n')[0].split(/\s+/).slice(1).map(Number)
  const [user, nice, system, , , irq, softirq, steal] = line
  return (user + nice + system + irq + softirq + steal) * 1e7
}

function udp_socket () {
  const fd = net.socket(net.AF_INET, net.SOCK_DGRAM, 0)
  assert(fd > 2, `socket ${lo.errno}`)
  return fd
}
function setsockopt_int (fd, opt, v) {
  const b = ptr(new Int32Array([v]))
  return net.setsockopt(fd, SOL_SOCKET, opt, b.ptr, 4)
}

// ---------------------------------------------------------------------------------------------------------------
// sender (a child process): `--sender <udp|kwg> <packets> <tmpdir>`
function sender (mode, total, tmp) {
  if (mode === 'kwg') {
    assert(core.unshare(core.CLONE_NEWNET) === 0, `unshare ${lo.errno}`)
    write_text(`${tmp}/ns.ready`, `${core.getpid()}\n`)
    const t = hrtime()
    while (!exists(`${tmp}/moved`)) {
      core.usleep(1000)
      if (hrtime() - t > 10e9) { write_text(`${tmp}/sender.txt`, 'timeout waiting for the device\n'); return }
    }
    for (const c of ['ip link set lo up', 'ip addr add 10.0.0.2/32 dev wgclient', 'ip link set wgclient up',
      'ip route add 10.0.0.0/24 dev wgclient']) {
      assert(sh(c) === 0, `${c} failed`)
    }
  }
  // the same IO as lib/sanstun/peer.js: a connected non-blocking socket on lo's epoll loop, one send() per packet,
  // EAGAIN -> poll and retry
  const loop = new Loop()
  const node = new Node(loop)
  const drop = ptr(new Uint8Array(2048))
  node.bind('0.0.0.0', () => { while (net.recv(node.fd, drop.ptr, drop.length, 0) >= 0) {} }, SRC_PORT)
  setsockopt_int(node.fd, SO_SNDBUFFORCE, 8 << 20)
  assert(node.connect(mode === 'kwg' ? '10.0.0.1' : '127.0.0.1', PORT) === 0, `connect ${lo.errno}`)
  const buf = ptr(new Uint8Array(PAYLOAD))
  const seq = new Int32Array(buf.buffer, 0, 1)
  // warm-up: lets kernel WireGuard complete its handshake (the first packets trigger it)
  seq[0] = -1
  for (let i = 0; i < 20; i++) { net.send(node.fd, buf.ptr, PAYLOAD, 0); core.usleep(20000) }
  core.usleep(200000)
  let sent = 0, eagain = 0
  const t0 = hrtime()
  while (sent < total) {
    loop.poll(0)
    for (let i = 0; i < 32 && sent < total; i++) {
      seq[0] = sent
      while (net.send(node.fd, buf.ptr, PAYLOAD, 0) < 0) { eagain++; loop.poll(0) }
      sent++
    }
  }
  const ns = hrtime() - t0
  node.close()
  write_text(`${tmp}/sender.txt`, `${sent} ${eagain} ${ns}\n`)
}

// receiver: the peer.js receive side without the crypto. Drains the socket on readable, counts packets with
// seq >= 0 until all arrived or 1 s without one
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
  return { got: r.got, ns: r.last - r.first }
}

function receiver_socket (mode) {
  const r = { loop: new Loop(), got: 0, first: 0, last: 0 }
  r.node = new Node(r.loop)
  const buf = ptr(new Uint8Array(2048))
  const seq = new Int32Array(buf.buffer, 0, 1)
  r.node.bind('0.0.0.0', () => {
    for (;;) {
      const n = net.recv(r.node.fd, buf.ptr, buf.length, 0)
      if (n < 0) return
      if (n !== PAYLOAD || seq[0] < 0) continue
      const now = hrtime()
      if (!r.first) r.first = now
      r.last = now
      r.got++
    }
  }, PORT)
  setsockopt_int(r.node.fd, SO_RCVBUFFORCE, 32 << 20)
  assert(r.node.connect(mode === 'kwg' ? '10.0.0.2' : '127.0.0.1', SRC_PORT) === 0, `connect ${lo.errno}`)
  return r
}

// ---------------------------------------------------------------------------------------------------------------
// kernel WireGuard set-up (the wg.js configuration, with the client's endpoint on the underlay address)
let wg = null
async function kwg_setup () {
  const W = await import('lib/wireguard.js')
  const { netlink } = lo.load('netlink')
  const { wireguard, Peer, Device, AllowedIP } = W
  const key = () => ptr(new Uint8Array(32))
  const spriv = key(), spub = key(), cpriv = key(), cpub = key()
  wireguard.genprivKey(spriv.ptr); wireguard.genpubKey(spub.ptr, spriv.ptr)
  wireguard.genprivKey(cpriv.ptr); wireguard.genpubKey(cpub.ptr, cpriv.ptr)
  const peerFlags = W.WGPEER_HAS_PUBLIC_KEY | W.WGPEER_REPLACE_ALLOWEDIPS
  const devFlags = W.WGDEVICE_HAS_PRIVATE_KEY | W.WGDEVICE_HAS_LISTEN_PORT
  const keep = [] // the structs must stay alive until wireguard.set
  function device (name, port, priv, peerPub, allowed, cidr, endpoint) {
    const ip = new AllowedIP()
    ip.family = net.AF_INET
    ip.address4 = allowed
    ip.cidr = cidr
    const peer = new Peer()
    peer.flags = peerFlags
    peer.firstip = ip.ptr
    peer.lastip = ip.ptr
    peer.pubkey.set(peerPub)
    if (endpoint) peer.endpoint = endpoint
    const d = new Device()
    d.name = name
    d.flags = port ? devFlags : W.WGDEVICE_HAS_PRIVATE_KEY
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
  wg = { wireguard }
}
function kwg_teardown () {
  sh('ip link del wgserver 2>/dev/null; ip link del wgclient 2>/dev/null')
}

// one UDP run: plain loopback ('udp') or through kernel WireGuard ('kwg')
async function udp_run (mode, total, lo_bin, self) {
  const tmp = `/tmp/bench-wireguard-${core.getpid()}`
  sh(`rm -rf ${tmp} && mkdir -p ${tmp}`)
  if (mode === 'kwg') await kwg_setup()
  const rx = receiver_socket(mode)
  const busy0 = cpu_busy_ns()
  const pid = exec_nowait(lo_bin, [self, '--sender', mode, String(total), tmp])
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
  const [sent] = report.split(' ').map(Number)
  sh(`rm -rf ${tmp}`)
  if (!r.got) return { error: `no packets delivered (sender: ${report || 'no report'})` }
  return { ns: r.ns / r.got, cpu: busy / r.got, got: r.got, sent, loss: 1 - r.got / (sent || total) }
}

// one in-memory pipeline run (lo offload.js or the Rust binary)
function pipe_run (cmd, total) {
  const busy0 = cpu_busy_ns()
  const { rc, out } = sh_out(cmd, `/tmp/bench-wireguard-${core.getpid()}.out`)
  const busy = cpu_busy_ns() - busy0
  // the summary line (per-worker lines before it also say ns/packet)
  const ns = Number((out.match(/a->b in \d+ ms, (\d+) ns\/packet/) || [])[1])
  if (rc !== 0 || !ns || !out.includes(`all ${total} checked`)) return { error: `failed: ${out.trim().split('\n').pop()}` }
  return { ns, cpu: busy / total, got: total, sent: total, loss: 0 }
}

// two sanstun peers over UDP (lib/sanstun/peer.js), one process each, `workers` crypto cells per side
function peer_run (lo_bin, peer, workers, total) {
  const tmp = `/tmp/bench-wireguard-${core.getpid()}`
  sh(`rm -rf ${tmp} && mkdir -p ${tmp}`)
  const busy0 = cpu_busy_ns()
  const args = r => [peer, r, String(workers), String(total), String(SIZE), r === 'recv' ? '9101' : '9102',
    r === 'recv' ? '9102' : '9101', tmp]
  const rpid = exec_nowait(lo_bin, args('recv'))
  const spid = exec_nowait(lo_bin, args('send'))
  waitfor(spid)
  waitfor(rpid)
  const busy = cpu_busy_ns() - busy0
  const recv = read_text(`${tmp}/recv.txt`).trim(), send = read_text(`${tmp}/send.txt`).trim()
  sh(`rm -rf ${tmp}`)
  const [got, ns, bad] = recv.split(' ').map(Number)
  const [sent] = send.split(' ').map(Number)
  if (!got) return { error: `no packets delivered (recv: ${recv || 'no report'}, send: ${send || 'no report'})` }
  if (bad) return { error: `${bad} packets out of order or with the wrong length` }
  return { ns: ns / got, cpu: busy / got, got, sent, loss: 1 - got / (sent || total) }
}

// ---------------------------------------------------------------------------------------------------------------
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN }
// lo has no Intl: thousands separators by hand
function fmt (v, d = 0) {
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
  const maxw = Number(lo.args[4] || 3)
  const report_path = lo.args[5] || 'lib/sanstun/bench/bench-wireguard.md'
  const dir = lo.getcwd()
  const self = `${dir}/lib/sanstun/bench/bench-wireguard.js`
  const lo_bin = `${dir}/lo`
  const offload = `${dir}/lib/sanstun/offload.js`
  const rust = `${dir}/lib/sanstun/bench/sanstun-offload`
  const peer = `${dir}/lib/sanstun/peer.js`
  for (const f of [self, lo_bin, offload, rust, peer]) assert(exists(f), `${f} missing: run from repos/lo`)
  const have_wg = gzipConfig().includes('CONFIG_WIREGUARD=y') && typeof core.unshare === 'function'
  const ncpu = (read_proc('/proc/cpuinfo').match(/^processor/gm) || []).length
  // two peer processes: their main threads plus workers on each side should fit the CPUs
  const peer_workers = Math.max(0, Math.min(maxw, Math.floor((ncpu - 2) / 2)))

  // section 'mem': one process, no networking; section 'net': two processes over real UDP
  const scenarios = []
  const plural = w => `${w} crypto worker${w > 1 ? 's' : ''}`
  for (let w = 0; w <= maxw; w++) {
    scenarios.push({ key: `lo-${w}`, section: 'mem', group: 'lo', label: w ? `lo, ${plural(w)}` : 'lo, single thread',
      run: () => pipe_run(`${lo_bin} ${offload} ${w} ${total} ${SIZE} atomics`, total) })
    scenarios.push({ key: `rs-${w}`, section: 'mem', group: 'rust', label: w ? `Rust, ${plural(w)}` : 'Rust, single thread',
      run: () => pipe_run(`${rust} ${w} ${total} ${SIZE} seqcst`, total) })
  }
  scenarios.push({ key: 'udp', section: 'net', group: 'io', label: 'plain UDP, no crypto',
    run: () => udp_run('udp', total, lo_bin, self) })
  for (let w = 0; w <= peer_workers; w++) {
    scenarios.push({ key: `peer-${w}`, section: 'net', group: 'lo',
      label: w ? `lo sanstun peers, ${plural(w)} each` : 'lo sanstun peers, single thread',
      run: () => peer_run(lo_bin, peer, w, total) })
  }
  if (have_wg) {
    scenarios.push({ key: 'kwg', section: 'net', group: 'kernel', label: 'lo + kernel WireGuard',
      run: () => udp_run('kwg', total, lo_bin, self) })
  }
  const results = Object.fromEntries(scenarios.map(s => [s.key, []]))
  const errors = {}
  const started = new Date()
  kwg_teardown() // leftovers from an interrupted run
  for (let r = 1; r <= rounds; r++) {
    for (const s of scenarios) {
      const t = hrtime()
      const res = await s.run()
      if (res.error) errors[s.key] = res.error
      else results[s.key].push(res)
      console.log(`round ${r}/${rounds} ${s.label}: ${res.error || `${fmt(res.ns)} ns/packet, CPU ${fmt(res.cpu)} ns/packet` +
        (res.loss > 0.0005 ? `, loss ${fmt(res.loss * 100, 1)}%` : '')} (${fmt((hrtime() - t) / 1e9, 1)} s)`)
    }
  }

  // report
  const rows = scenarios.map(s => {
    const rs = results[s.key]
    const ns = median(rs.map(x => x.ns))
    return {
      ...s, ns, cpu: median(rs.map(x => x.cpu)), loss: median(rs.map(x => x.loss)), n: rs.length,
      runs: rs.map(x => fmt(x.ns)).join(' / '), gbit: (SIZE * 8) / ns, mpps: 1e3 / ns
    }
  })
  const icon = { lo: '🟦', rust: '🟧', kernel: '🟩', io: '⬜' }
  const kernel = read_proc('/proc/version').split(' ').slice(0, 3).join(' ')
  const cpu_model = (read_proc('/proc/cpuinfo').match(/model name\s*:\s*(.*)/) || [])[1] || 'unknown'
  const md = []
  md.push('# WireGuard benchmark: sanstun (lo, Rust) and kernel WireGuard', '')
  md.push(`${started.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${kernel} · ${ncpu} × ${cpu_model} · ` +
    `lo ${lo.version.lo} (V8 ${lo.version.v8}) · ${rounds} rounds × ${fmt(total)} packets of ${fmt(SIZE)} B, medians`, '')
  md.push('> **Two kinds of measurement, not comparable with each other.** Section 1 is the WireGuard protocol work ' +
    'alone: one process holds both peers and passes packets through memory, with **no networking at all** (no ' +
    'sockets, no syscalls). Section 2 is **real traffic**: two processes, packets over UDP through the kernel\'s ' +
    'network stack, one syscall per packet on each side. Compare rows within a section.', '')
  function section (title, intro, list, base_key) {
    const base = rows.find(r => r.key === base_key)
    const max_gbit = Math.max(...list.map(r => r.gbit).filter(Number.isFinite))
    const max_cpu = Math.max(...list.map(r => r.cpu).filter(Number.isFinite))
    const width = Math.max(...list.map(r => r.label.length))
    md.push(`## ${title}`, '', intro, '')
    md.push(`| | scenario | ns/packet | Gbit/s | M packets/s | CPU ns/packet | vs ${base.label} | runs (ns/packet) |`)
    md.push('|---|---|---:|---:|---:|---:|---:|---|')
    for (const r of list) {
      const vs = Number.isFinite(base.ns) && Number.isFinite(r.ns) ? `${fmt(base.ns / r.ns, 2)}×` : 'n/a'
      md.push(`| ${icon[r.group]} | ${r.label}${r.loss > 0.0005 ? ` (loss ${fmt(r.loss * 100, 1)}%)` : ''} | ${fmt(r.ns)} | ` +
        `${fmt(r.gbit, 2)} | ${fmt(r.mpps, 3)} | ${fmt(r.cpu)} | ${vs} | ${r.runs || errors[r.key] || ''} |`)
    }
    md.push('', '**Throughput** (Gbit/s of inner packets, higher is better)', '', '```')
    for (const r of list) md.push(`${icon[r.group]} ${r.label.padEnd(width)} ${bar(r.gbit, max_gbit).padEnd(37)} ${fmt(r.gbit, 2)}`)
    md.push('```', '', '**CPU time per packet**, all CPUs (ns, lower is better)', '', '```')
    for (const r of list) md.push(`${icon[r.group]} ${r.label.padEnd(width)} ${bar(r.cpu, max_cpu).padEnd(37)} ${fmt(r.cpu)}`)
    md.push('```', '')
  }
  section('1. Protocol only: in memory, no networking',
    '🟦 lo and 🟧 Rust run the same sanstun pipeline (encapsulate → receive → decapsulate → commit, every packet ' +
    'checked) in one process holding both peers: `lib/sanstun/offload.js` and `lib/sanstun/bench/sanstun-offload`. With ' +
    'workers, the main thread keeps the tunnel state and the workers encrypt and decrypt.',
    rows.filter(r => r.section === 'mem'), 'lo-0')
  section('2. Real networking: two processes over UDP',
    'A sender process and a receiver process on loopback, one `send`/`recv` per packet, measured at the receiver ' +
    '(first to last packet; loss = packets sent but not delivered).\n\n' +
    '- ⬜ **plain UDP, no crypto**: the IO baseline, the cost of the sockets and the network stack alone.\n' +
    '- 🟦 **lo sanstun peers** (`lib/sanstun/peer.js`): a userspace WireGuard peer per process, epoll-driven, ' +
    'ciphertext over UDP; with workers, each side moves its crypto to cells.\n' +
    '- 🟩 **lo + kernel WireGuard**: a lo sender in its own network namespace sends through `wgclient` to a lo ' +
    'receiver behind `wgserver`; the kernel encrypts and decrypts on all CPUs and each packet crosses the network ' +
    'stack twice (inner and outer).',
    rows.filter(r => r.section === 'net'), 'udp')
  md.push('## Notes', '')
  md.push('- **CPU ns/packet** is the busy time of all CPUs (from `/proc/stat`) over the run divided by packets: the ' +
    'fair comparison between single-threaded, offloaded and kernel runs. It includes process start-up (~1-3%), and ' +
    'the offload rows include threads busy-spinning while they wait for each other.')
  md.push('- No batching anywhere yet (`sendmmsg`/`recvmmsg`, GSO/GRO): one syscall per packet is what section 2 ' +
    'measures, and it dominates.')
  if (Object.keys(errors).length) {
    md.push('', '## Errors', '')
    for (const [k, e] of Object.entries(errors)) md.push(`- ${k}: ${e}`)
  }
  if (!have_wg) md.push('', '_Kernel WireGuard skipped: needs `CONFIG_WIREGUARD=y` and a lo with `core.unshare`._')
  const text = md.join('\n') + '\n'
  write_text(report_path, text)
  console.log('\n' + text)
  console.log(`report written to ${report_path}`)
}

function gzipConfig () {
  const out = `/tmp/bench-wireguard-${core.getpid()}.config`
  sh(`gzip -dc /proc/config.gz > ${out} 2>/dev/null`)
  const s = read_text(out)
  sh(`rm -f ${out}`)
  return s
}

if (lo.args[2] === '--sender') {
  sender(lo.args[3], Number(lo.args[4]), lo.args[5])
} else {
  await main()
}
