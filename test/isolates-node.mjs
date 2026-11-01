// Node counterpart of test/isolates.js, for comparison: spawn worker_threads
// Workers one after another (each its own isolate and thread), sample RSS
// every SAMPLE workers after a warm-up, and report the least-squares slope of
// RSS in bytes per worker. Same env vars and output as test/isolates.js.
//
// env: ISOLATES_WARMUP (5000), ISOLATES_COUNT (20000), ISOLATES_SAMPLE (1000),
//      ISOLATES_MAX_SLOPE (40, bytes per isolate)
//
// node test/isolates-node.mjs
import { Worker } from 'node:worker_threads'

function env_int (name, value) {
  const v = process.env[name]
  return v ? parseInt(v, 10) : value
}

const warmup = env_int('ISOLATES_WARMUP', 5000)
const count = env_int('ISOLATES_COUNT', 20000)
const sample = env_int('ISOLATES_SAMPLE', 1000)
const max_slope = env_int('ISOLATES_MAX_SLOPE', 40)

// the same work as a lo cell; exits with foo as its exit code
const main = 'globalThis.foo = (globalThis.foo | 0) + 1; process.exit(foo)'

function spawn_one () {
  return new Promise((resolve, reject) => {
    const worker = new Worker(main, { eval: true })
    worker.on('error', reject)
    worker.on('exit', code => code === 1 ? resolve() : reject(new Error(`worker exit code ${code}`)))
  })
}

async function spawn (n) {
  for (let i = 0; i < n; i++) await spawn_one()
}

// least squares slope of y over x
function slope (xs, ys) {
  const n = xs.length
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]
    sy += ys[i]
    sxx += xs[i] * xs[i]
    sxy += xs[i] * ys[i]
  }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx)
}

// with --expose-gc, collect the main thread's garbage (Worker objects, ports) before each sample
const mem = () => { globalThis.gc?.(); return process.memoryUsage.rss() }
const start_rss = mem()
await spawn(warmup)
const xs = [0]
const ys = [mem()]
const start = process.hrtime.bigint()
for (let done = 0; done < count; done += sample) {
  await spawn(sample)
  xs.push(done + sample)
  ys.push(mem())
}
const elapsed = Number(process.hrtime.bigint() - start)
const heap = process.memoryUsage().heapUsed
const per_isolate = slope(xs, ys)
const usec = Math.round(elapsed / count / 1000)
console.log(`isolates (node ${process.version}): warm-up ${warmup} (+${ys[0] - start_rss} bytes rss), measured ${count}: ${usec} µs each, rss ${ys[0]} -> ${ys[ys.length - 1]}, slope ${per_isolate.toFixed(1)} bytes/isolate (max ${max_slope}), main heap used ${heap}`)
if (per_isolate > max_slope) {
  console.error(`rss grows ${per_isolate.toFixed(1)} bytes per isolate`)
  process.exit(1)
}
