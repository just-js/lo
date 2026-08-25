// Measures tsgo's real per-edit recheck cost in a warm, persistent
// server process - see LO-TYPESCRIPT.md section 17.12/20.
//
// SAFETY: always run this pinned to 1-2 cores, e.g.:
//   taskset -c 0,1 node bench-tsgo-api-edit.mjs big 30s
// An earlier version of this script ran unpinned at up to 1000
// iterations with a real bug (see below) still unfixed, and locked up
// the whole sandbox - had to be killed by hand. Default here is a small
// fixed count; raise it (or switch to a duration) gradually, always
// taskset-pinned.
//
// Two real bugs found and fixed getting here, in order:
//
// 1. The original version reused the same `project` handle across every
//    `updateSnapshot()` call. `updateSnapshot()` returns a distinct
//    Snapshot object each time (confirmed via `class Snapshot { readonly
//    id: number; ... }` in the API's own types) - snapshots are
//    immutable/versioned, so calling methods on a stale Project/Program
//    keeps returning the state as of when *that* snapshot was taken,
//    never the latest edit. Fixed by re-fetching `snapshot.getProject()`
//    from the *new* snapshot returned by every updateSnapshot() call, and
//    disposing the previous snapshot afterward so resources don't
//    accumulate across iterations.
// 2. Tried moving the whole loop to an in-memory virtual FileSystem (`fs`
//    option) instead of real disk writes, to avoid any real I/O.
//    Instrumented it directly: the registered readFile/fileExists
//    callbacks were never invoked at all, for a file that also exists for
//    real on disk at that path - the server appears to only delegate to
//    the client's fs for paths it can't resolve on the real filesystem at
//    all (a genuinely virtual path, not real-file override), which this
//    preview API's own README describes as expected ("many gaps" in an
//    early preview). Not pursued further given the time already spent;
//    reverted to real (but now small, throttled) disk writes below, which
//    don't have this ambiguity.
//
// Verification, not just timing: every other iteration deliberately
// injects a real type error (assigning a string to a `number`-typed
// const) and asserts getSemanticDiagnostics() actually reports it, and
// reports zero when the edit is valid. This is the load-bearing check -
// if it doesn't pass, the timing numbers below it are meaningless.
//
// Two measurement modes (3rd arg):
//   incremental (default) - api.updateSnapshot({fileChanges: {changed}}),
//     timing just the notify+diagnostics-fetch. Whatever per-file
//     incremental reuse the server does internally is included for free -
//     this is what a real editor would call.
//   full - closes and reopens the *whole project* every iteration before
//     fetching diagnostics, forcing no project-level incremental reuse at
//     all, timing the entire close+reopen+diagnostics cycle. Directly
//     tests whether "incremental" mode is doing meaningfully less work.
//     Caveat, not fully equivalent to lo/tsc2.js's own "full recompile":
//     this also re-parses lib.es5.d.ts/decorators fresh every time (lo
//     caches those once, only reparses the target file) - so "full" mode
//     here does strictly *more* work than lo's comparison point, not an
//     exact match. Treat it as an upper bound / "no reuse at all"
//     reference, not a precisely fair like-for-like number.
//
//     UNSTABLE - use with real caution, small N, short durations only.
//     Confirmed twice: rapid repeated close+reopen eventually produces a
//     multi-second pathological call (one observed at ~19.5s) followed by
//     the server process crashing ("Unexpected EOF"/"context canceled"),
//     even taskset-pinned to 2 cores - and that multi-second call alone
//     was enough to make the whole sandbox feel locked up. Not used by
//     bench-warm-compare.mjs's default comparison for this reason - only
//     `incremental` mode is (verified stable across a full 20s/324-
//     iteration run with zero issues). Run `full` manually, pinned, small
//     N/duration, if you specifically want to poke at it.
//
// Usage: node bench-tsgo-api-edit.mjs [small|big] [iterations|Ns] [incremental|full]
import { API } from '@typescript/native-preview/unstable/sync'
import { readFileSync, writeFileSync } from 'node:fs'

const target = process.argv[2] === 'small' ? 'small' : 'big'
const configFile = `tsconfig.bench.${target}.json`
const targetFile = `${target}.ts`
const rawSpec = process.argv[3] || '20'
const mode = process.argv[4] === 'full' ? 'full' : 'incremental'
const durationMatch = /^(\d+)s$/.exec(rawSpec)
const spec = durationMatch
  ? { mode: 'duration', durationMs: parseInt(durationMatch[1], 10) * 1000 }
  : { mode: 'count', count: parseInt(rawSpec, 10) || 20 }
const original = readFileSync(targetFile, 'utf8')

const api = new API({ collectTiming: true })
let snapshot = api.updateSnapshot({ openProjects: [configFile] })
let project = snapshot.getProject(configFile)
if (!project) throw new Error(`project not found - check ${configFile}`)

// warm it up once (first call always pays initial parse/bind/check)
const warmupDiagnostics = project.program.getSemanticDiagnostics()
console.log(`mode: ${mode}`)
console.log('diagnostics on initial (unmodified) content:', warmupDiagnostics.length, '(expected 0)')

const times = []
let mismatches = 0
const loopStart = process.hrtime.bigint()
try {
  let i = 0
  while (spec.mode === 'duration' ? Number(process.hrtime.bigint() - loopStart) / 1e6 < spec.durationMs : i < spec.count) {
    const shouldError = i % 2 === 1
    const trailer = shouldError
      ? `\nconst __bench_check_${i}: number = 'not a number' // edit ${i}\n`
      : `\nconst __bench_check_${i}: number = ${i} // edit ${i}\n`
    writeFileSync(targetFile, original + trailer)

    const start = process.hrtime.bigint()

    // See bug 1 above: must re-fetch the project from the *new* snapshot,
    // not reuse the old handle, or diagnostics silently never update.
    if (mode === 'full') {
      const closed = api.updateSnapshot({ closeProjects: [configFile] })
      closed.dispose()
      snapshot = api.updateSnapshot({ openProjects: [configFile], fileChanges: { changed: [targetFile] } })
    } else {
      const previous = snapshot
      snapshot = api.updateSnapshot({ fileChanges: { changed: [targetFile] } })
      previous.dispose()
    }
    project = snapshot.getProject(configFile)
    const diagnostics = project.program.getSemanticDiagnostics()

    const end = process.hrtime.bigint()
    times.push(Number(end - start) / 1e6)

    const gotError = diagnostics.length > 0
    if (gotError !== shouldError) {
      mismatches++
      console.error(`MISMATCH at iteration ${i}: expected error=${shouldError}, got ${diagnostics.length} diagnostics`)
    }
    i++
  }
} finally {
  writeFileSync(targetFile, original)
}

const sorted = times.slice().sort((a, b) => a - b)
const sum = times.reduce((a, b) => a + b, 0)
const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
console.log(`\niterations: ${times.length}, mismatches: ${mismatches} (0 expected - proves genuine per-call rechecking, not stale/cached results)`)
console.log(`mean: ${(sum / times.length).toFixed(3)}ms  min: ${sorted[0].toFixed(3)}ms  p50: ${pct(0.5).toFixed(3)}ms  p75: ${pct(0.75).toFixed(3)}ms  p90: ${pct(0.9).toFixed(3)}ms  p99: ${pct(0.99).toFixed(3)}ms  max: ${sorted[sorted.length - 1].toFixed(3)}ms`)
console.log('first 10 (raw temporal order):', times.slice(0, 10).map(t => t.toFixed(3)).join(', '))
console.log('last 10 (raw temporal order, drift check):', times.slice(-10).map(t => t.toFixed(3)).join(', '))

snapshot.dispose()
api.close()

if (mismatches > 0) {
  console.error(`\nFAILED: ${mismatches} mismatches - diagnostics did not reflect the actual edit, do not trust the timing numbers above`)
  process.exit(1)
}
