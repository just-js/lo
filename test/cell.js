// lib/cell.js: a worker isolate controlled from another thread. Checks:
// - normal exit: exit_reason 'normal'
// - terminate(): a busy loop is stopped, exit_reason 'terminated'
// - request_stats(): the isolate writes its heap stats into its context
// - heap_limit: a worker growing its JS heap is terminated near the limit
//   instead of V8 aborting the process, exit_reason 'heap limit'
// - with --enforce-global-heap-limit, ArrayBuffer memory counts too
// - policy and cpus are applied to the thread at start
// the process surviving to the end is part of the test (OOM would abort it)
//
// lo test/cell.js
import { Cell } from 'lib/cell.js'

const { assert, core } = lo
const { usleep } = core
const { system } = lo.load('system')
const { SCHED_BATCH } = system

const MB = 1024 * 1024
const ms = n => usleep(n * 1000)

function ok (name) {
  console.log(`ok ${name}`)
}

function run (source, options = {}) {
  return new Cell('', [], source, options).create()
}

// /proc/self/task/<tid>/stat field 41 is the scheduling policy. comm (field
// 2) has no spaces for these threads
function policy (tid) {
  const fd = core.open(`/proc/self/task/${tid}/stat`, core.O_RDONLY, 0)
  const buf = lo.ptr(new Uint8Array(1024))
  const n = core.pread(fd, buf.ptr, buf.length, 0)
  core.close(fd)
  return parseInt(new TextDecoder().decode(buf.subarray(0, n)).split(' ')[40], 10)
}

{
  const cell = run('globalThis.x = 1')
  cell.start().waitfor()
  assert(cell.exit_reason === 'normal', `exit reason ${cell.exit_reason}`)
  cell.close().free()
  ok('normal exit')
}

{
  const cell = run('let x = 0; while (true) x++')
  cell.start()
  assert(cell.pidfd >= 0, 'pidfd')
  ms(500)
  assert(cell.sample(), 'sample')
  assert(cell.demand > 0.5, `spinner demand ${cell.demand}`)
  assert(cell.terminate() === 0, 'terminate')
  cell.waitfor()
  assert(cell.exit_reason === 'terminated', `exit reason ${cell.exit_reason}`)
  assert(cell.terminate() === -1, 'terminate after exit')
  cell.close().free()
  ok('terminate a busy loop')
}

{
  // the V8 loop stack check bug lib/cell.js works around: without
  // --no-turboshaft-loop-unrolling this loop never sees the termination
  const cell = run('while (true) new Array(1000).fill(1)')
  cell.start()
  ms(500)
  cell.terminate()
  let waited = 0
  let running = true
  while ((running = cell.poll()) && waited < 2000) {
    ms(10)
    waited += 10
  }
  assert(!running, 'optimized loop with an inlined fill was not terminated')
  // poll() joined it: waitfor() would join again
  assert(cell.exit_reason === 'terminated', `exit reason ${cell.exit_reason}`)
  cell.close().free()
  ok('terminate an optimized loop with an inlined fill')
}

{
  const cell = run(`
const keep = []
for (let i = 0; i < 200000; i++) keep.push({ i, s: 'x' + i })
let x = 0
while (true) x++
`)
  cell.start()
  ms(1000)
  assert(cell.request_stats() === 0, 'request_stats')
  ms(100)
  const heap = cell.heap
  assert(heap.time > 0, 'stats written')
  assert(heap.used > 4 * MB, `heap used ${heap.used}`)
  assert(heap.max > heap.total, `heap max ${heap.max} total ${heap.total}`)
  cell.terminate()
  cell.waitfor()
  cell.close().free()
  ok(`heap stats (used ${Math.round(heap.used / MB)} MB, max ${Math.round(heap.max / MB)} MB, ${heap.gcs} gcs)`)
}

{
  const cell = run(`
const keep = []
while (true) keep.push(new Array(1000).fill(1))
`, { heap_limit: 32 * MB })
  cell.start().waitfor()
  assert(cell.exit_reason === 'heap limit', `exit reason ${cell.exit_reason}`)
  cell.close().free()
  ok('JS heap limit terminates the isolate')
}

{
  // global limit = heap limit x factor, and includes external memory
  lo.setFlags('--enforce-global-heap-limit --maximum-global-heap-limit-factor=2')
  // stops by itself after 512 MB: if ArrayBuffers did not count, it exits
  // 'normal' and the test fails (instead of allocating forever)
  const cell = run(`
const keep = []
for (let i = 0; i < 512; i++) keep.push(new ArrayBuffer(1024 * 1024))
`, { heap_limit: 32 * MB })
  cell.start().waitfor()
  assert(cell.exit_reason === 'heap limit', `exit reason ${cell.exit_reason}`)
  cell.close().free()
  ok('ArrayBuffer memory counts with --enforce-global-heap-limit')
}

{
  const cell = run('let x = 0; while (true) x++', { policy: SCHED_BATCH })
  cell.start([1])
  ms(200)
  assert(policy(cell.thread_id) === SCHED_BATCH, `policy ${policy(cell.thread_id)}`)
  assert(cell.affinity.join(',') === '1', `affinity ${cell.affinity}`)
  cell.terminate()
  cell.waitfor()
  cell.close().free()
  ok('policy and affinity at start')
}

console.log('all ok')
