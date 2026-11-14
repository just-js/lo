// sanstun peers over UDP with GSO on the sender and UDP GRO on the receiver (lib/sanstun/peer.js ... gso). A separate
// test; compare with section 2 of bench-wireguard.md (the same peers without GSO/GRO). Writes a markdown report.
//
// usage (from repos/lo, as root, full-V8 ./lo):
//   ./lo $PWD/lib/sanstun/bench/bench-wireguard-sanstun-gso.js [rounds=3] [packets=1000000] [report=lib/sanstun/bench/bench-wireguard-sanstun-gso.md]
//
// Two lo processes, one sanstun WireGuard peer each, connected non-blocking UDP sockets on lo's epoll loop. The
// sender encrypts up to 45 packets back to back at the ciphertext stride (1,440 B for 1,400-byte inner packets) and
// sends them with one send()/sendmsg() and UDP_SEGMENT; the receiver reads GRO super-datagrams and decrypts each
// segment. With workers, each side moves its crypto to cells (the offload.js ring), sendmsg() takes an iovec over the
// ready ring entries and recvmsg() scatters straight into them. Measured at the receiver; CPU from /proc/stat.
import { exec, exec_nowait, waitfor } from 'lib/proc.js'

const { core, assert, ptr, hrtime } = lo
const enc = new TextEncoder()
const dec = new TextDecoder()
const SIZE = 1400

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

function peer_run (lo_bin, peer, workers, total) {
  const tmp = `/tmp/bench-wireguard-sanstun-gso-${core.getpid()}`
  sh(`rm -rf ${tmp} && mkdir -p ${tmp}`)
  const busy0 = cpu_busy_ns()
  const args = r => [peer, r, String(workers), String(total), String(SIZE), r === 'recv' ? '9101' : '9102',
    r === 'recv' ? '9102' : '9101', tmp, 'gso']
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
  return { ns: ns / got, cpu: busy / got, loss: 1 - got / (sent || total) }
}

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

const rounds = Number(lo.args[2] || 3)
const total = Number(lo.args[3] || 1000000)
const report_path = lo.args[4] || 'lib/sanstun/bench/bench-wireguard-sanstun-gso.md'
const dir = lo.getcwd()
const lo_bin = `${dir}/lo`
const peer = `${dir}/lib/sanstun/peer.js`
for (const f of [lo_bin, peer]) assert(exists(f), `${f} missing: run from repos/lo`)
const ncpu = (read_proc('/proc/cpuinfo').match(/^processor/gm) || []).length
const max_workers = Math.max(0, Math.floor((ncpu - 2) / 2)) // both processes' main threads + workers fit the CPUs
const scenarios = []
for (let w = 0; w <= max_workers; w++) {
  scenarios.push({ key: `gso-${w}`, workers: w,
    label: w ? `lo sanstun peers, GSO + GRO, ${w} crypto worker${w > 1 ? 's' : ''} each` : 'lo sanstun peers, GSO + GRO, single thread' })
}
const results = Object.fromEntries(scenarios.map(s => [s.key, []]))
const errors = {}
const started = new Date()
for (let r = 1; r <= rounds; r++) {
  for (const s of scenarios) {
    const t = hrtime()
    const res = peer_run(lo_bin, peer, s.workers, total)
    if (res.error) errors[s.key] = res.error
    else results[s.key].push(res)
    console.log(`round ${r}/${rounds} ${s.label}: ${res.error || `${fmt(res.ns)} ns/packet, CPU ${fmt(res.cpu)} ns/packet, ` +
      `loss ${fmt(res.loss * 100, 1)}%`} (${fmt((hrtime() - t) / 1e9, 1)} s)`)
  }
}
const rows = scenarios.map(s => {
  const rs = results[s.key]
  const ns = median(rs.map(x => x.ns))
  return { ...s, ns, gbit: (SIZE * 8) / ns, cpu: median(rs.map(x => x.cpu)), loss: median(rs.map(x => x.loss)),
    runs: rs.map(x => fmt(x.ns)).join(' / ') }
})
const kernel = read_proc('/proc/version').split(' ').slice(0, 3).join(' ')
const cpu_model = (read_proc('/proc/cpuinfo').match(/model name\s*:\s*(.*)/) || [])[1] || 'unknown'
const md = []
md.push('# sanstun peers over UDP with GSO + UDP GRO', '')
md.push(`${started.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${kernel} · ${ncpu} × ${cpu_model} · ` +
  `lo ${lo.version.lo} (V8 ${lo.version.v8}) · ${rounds} rounds × ${fmt(total)} packets of ${fmt(SIZE)} B, medians`, '')
md.push('Two lo processes, one sanstun WireGuard peer each (`lib/sanstun/peer.js ... gso`). The sender encrypts up to ' +
  '45 packets back to back and sends them with one call and `UDP_SEGMENT`; the receiver reads `UDP_GRO` ' +
  'super-datagrams and decrypts each segment. Compare with section 2 of bench-wireguard.md (the same peers, one ' +
  'syscall per packet) and with bench-wireguard-gro.md (plain UDP and kernel WireGuard with GSO + GRO).', '')
md.push('| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | runs (ns/packet) |')
md.push('|---|---|---:|---:|---:|---:|---|')
for (const r of rows) {
  md.push(`| 🟦 | ${r.label} | ${fmt(r.ns)} | ${fmt(r.gbit, 2)} | ${fmt(r.cpu)} | ${fmt(r.loss * 100, 1)}% | ${r.runs || errors[r.key] || ''} |`)
}
const width = Math.max(...rows.map(r => r.label.length))
const max_gbit = Math.max(...rows.map(r => r.gbit).filter(Number.isFinite))
const max_cpu = Math.max(...rows.map(r => r.cpu).filter(Number.isFinite))
md.push('', '**Throughput** (Gbit/s of inner packets, higher is better)', '', '```')
for (const r of rows) md.push(`🟦 ${r.label.padEnd(width)} ${bar(r.gbit, max_gbit).padEnd(37)} ${fmt(r.gbit, 2)}`)
md.push('```', '', '**CPU time per packet**, all CPUs (ns, lower is better)', '', '```')
for (const r of rows) md.push(`🟦 ${r.label.padEnd(width)} ${bar(r.cpu, max_cpu).padEnd(37)} ${fmt(r.cpu)}`)
md.push('```', '')
if (Object.keys(errors).length) { md.push('## Errors', ''); for (const [k, e] of Object.entries(errors)) md.push(`- ${k}: ${e}`) }
const text = md.join('\n') + '\n'
write_text(report_path, text)
console.log('\n' + text)
console.log(`report written to ${report_path}`)
