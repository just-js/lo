// Leak check for isolate create/teardown: spawn isolates one after another
// in a tight loop (lib/worker.js, a thread per isolate), sample RSS every
// SAMPLE isolates after a warm-up, and fail if the least-squares slope of
// RSS over the measured window is above MAX_SLOPE bytes per isolate.
//
// The warm-up matters: the first ~10k isolates grow RSS by several MB
// (allocator, V8's page pool, code space) before it levels off.
//
// env: ISOLATES_WARMUP (5000), ISOLATES_COUNT (20000), ISOLATES_SAMPLE (1000),
//      ISOLATES_MAX_SLOPE (40, bytes per isolate)
//
// lo test/isolates.js
import { Worker } from 'lib/worker.js'
import { mem } from 'lib/proc.js'

const { assert, getenv } = lo

function env_int (name, value) {
  const v = getenv(name)
  return v ? parseInt(v, 10) : value
}

const warmup = env_int('ISOLATES_WARMUP', 5000)
const count = env_int('ISOLATES_COUNT', 20000)
const sample = env_int('ISOLATES_SAMPLE', 1000)
const max_slope = env_int('ISOLATES_MAX_SLOPE', 40)

// each isolate runs this and exits with foo as its exit code, so we can
// check the cell really ran
const main = 'globalThis.foo = (globalThis.foo | 0) + 1; globalThis.onExit = () => foo'

function spawn (n) {
  for (let i = 0; i < n; i++) {
    const worker = new Worker('', [], main)
    worker.onexit = 1
    worker.create().start().waitfor().free()
    assert(worker.exit_code === 1, `isolate exit code ${worker.exit_code}`)
  }
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

const start_rss = mem()
spawn(warmup)
const xs = [0]
const ys = [mem()]
const start = lo.hrtime()
for (let done = 0; done < count; done += sample) {
  spawn(sample)
  xs.push(done + sample)
  ys.push(mem())
}
const elapsed = lo.hrtime() - start
const per_isolate = slope(xs, ys)
const usec = Math.round(elapsed / count / 1000)
console.log(`isolates: warm-up ${warmup} (+${ys[0] - start_rss} bytes rss), measured ${count}: ${usec} µs each, rss ${ys[0]} -> ${ys[ys.length - 1]}, slope ${per_isolate.toFixed(1)} bytes/isolate (max ${max_slope})`)
assert(per_isolate <= max_slope, `rss grows ${per_isolate.toFixed(1)} bytes per isolate`)
