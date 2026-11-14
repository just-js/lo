// GSO + UDP GRO with the crypto offloaded to worker threads: lo (lib/sanstun/peer.js <role> <workers> ... gso, cells)
// vs Rust (lib/sanstun/bench/sanstun-peer-offload, std threads; bench-rs/src/bin/peer_offload.rs), the same structure:
// main thread owns the tunnel, workers encrypt/decrypt, a 256-entry ring, sendmsg/recvmsg over up to 45 entries.
// A side with 0 workers runs the single-threaded peer (peer.js ... 0 ... gso / sanstun-peer). Worker layouts that
// fit 4 vCPUs: sender/receiver 1/1 and 0/2; 0/0 rows are the single-threaded reference. A separate test.
//
// usage (from repos/lo, as root, full-V8 ./lo):
//   ./lo $PWD/lib/sanstun/bench/bench-wireguard-offload-gso.js [rounds=3] [packets=1000000] [report=lib/sanstun/bench/bench-wireguard-offload-gso.md]
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

// impl: { send: [program, ...leading args], recv: [...] } per worker count; ws: { send, recv } workers
function peer_run (impl, ws, total) {
  const tmp = `/tmp/bench-wireguard-offload-gso-${core.getpid()}`
  sh(`rm -rf ${tmp} && mkdir -p ${tmp}`)
  const busy0 = cpu_busy_ns()
  const cmd = r => impl(ws[r])
  const args = r => [...cmd(r).slice(1), r, String(ws[r]), String(total), String(SIZE), r === 'recv' ? '9101' : '9102',
    r === 'recv' ? '9102' : '9101', tmp, 'gso']
  const rpid = exec_nowait(cmd('recv')[0], args('recv'))
  const spid = exec_nowait(cmd('send')[0], args('send'))
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
const report_path = lo.args[4] || 'lib/sanstun/bench/bench-wireguard-offload-gso.md'
const dir = lo.getcwd()
const lo_bin = `${dir}/lo`
const peer = `${dir}/lib/sanstun/peer.js`
const rust_std = `${dir}/lib/sanstun/bench/sanstun-peer`
const rust_offload = `${dir}/lib/sanstun/bench/sanstun-peer-offload`
for (const f of [lo_bin, peer, rust_std, rust_offload]) assert(exists(f), `${f} missing: run from repos/lo (build lib/sanstun/bench/bench-rs)`)
const ncpu = (read_proc('/proc/cpuinfo').match(/^processor/gm) || []).length
const lo_impl = w => [lo_bin, peer]
const rust_impl = w => w ? [rust_offload] : [rust_std]
const scenarios = []
for (const [sw, rw] of [[0, 0], [1, 1], [0, 2]]) {
  const what = sw + rw ? `sender ${sw} / receiver ${rw} workers` : 'single thread (reference)'
  scenarios.push({ key: `lo-${sw}-${rw}`, icon: '🟦', label: `lo, ${what}`, impl: lo_impl, ws: { send: sw, recv: rw } })
  scenarios.push({ key: `rs-${sw}-${rw}`, icon: '🟧', label: `Rust, ${what}`, impl: rust_impl, ws: { send: sw, recv: rw } })
}
const results = Object.fromEntries(scenarios.map(s => [s.key, []]))
const errors = {}
const started = new Date()
for (let r = 1; r <= rounds; r++) {
  for (const s of scenarios) {
    const t = hrtime()
    const res = peer_run(s.impl, s.ws, total)
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
md.push('# GSO + UDP GRO with the crypto on worker threads: lo vs Rust', '')
md.push(`${started.toISOString().slice(0, 16).replace('T', ' ')} UTC · ${kernel} · ${ncpu} × ${cpu_model} · ` +
  `lo ${lo.version.lo} (V8 ${lo.version.v8}) · ${rounds} rounds × ${fmt(total)} packets of ${fmt(SIZE)} B, medians`, '')
md.push('Two processes (sender and receiver), one sanstun WireGuard peer each, GSO (45 packets per `UDP_SEGMENT` ' +
  'send) and `UDP_GRO` receive. With workers, the main thread owns the tunnel and the workers encrypt/decrypt; lo ' +
  'uses cells (isolates on threads, `lib/sanstun/peer.js`), Rust uses std threads (`sanstun-peer-offload`), with ' +
  'the same ring, worker split and batching. lo\'s offload path is not optimized yet (it rebuilds its iovecs with ' +
  'BigInts per `recvmsg`); Rust builds its iovec table once. Measured at the receiver; CPU from /proc/stat.', '')
md.push('| | scenario | ns/packet | Gbit/s | CPU ns/packet | loss | runs (ns/packet) |')
md.push('|---|---|---:|---:|---:|---:|---|')
for (const r of rows) {
  md.push(`| ${r.icon} | ${r.label} | ${fmt(r.ns)} | ${fmt(r.gbit, 2)} | ${fmt(r.cpu)} | ${fmt(r.loss * 100, 1)}% | ${r.runs || errors[r.key] || ''} |`)
}
const width = Math.max(...rows.map(r => r.label.length))
const max_gbit = Math.max(...rows.map(r => r.gbit).filter(Number.isFinite))
const max_cpu = Math.max(...rows.map(r => r.cpu).filter(Number.isFinite))
md.push('', '**Throughput** (Gbit/s of inner packets, higher is better)', '', '```')
for (const r of rows) md.push(`${r.icon} ${r.label.padEnd(width)} ${bar(r.gbit, max_gbit).padEnd(37)} ${fmt(r.gbit, 2)}`)
md.push('```', '', '**CPU time per packet**, all CPUs (ns, lower is better)', '', '```')
for (const r of rows) md.push(`${r.icon} ${r.label.padEnd(width)} ${bar(r.cpu, max_cpu).padEnd(37)} ${fmt(r.cpu)}`)
md.push('```', '')
if (Object.keys(errors).length) { md.push('## Errors', ''); for (const [k, e] of Object.entries(errors)) md.push(`- ${k}: ${e}`) }
const text = md.join('\n') + '\n'
write_text(report_path, text)
console.log('\n' + text)
console.log(`report written to ${report_path}`)
