// Explores @typescript/native-preview's JSON-RPC "library" API: spawns the
// native tsgo binary once, in server mode, then issues many diagnostic
// requests against the same warm process/project - the direct analog of
// what a long-lived `lo` process could do on the JS side, isolating
// per-call check cost from process-spawn cost. See LO-TYPESCRIPT.md
// section 17.12/18.
// Usage: node bench-tsgo-api.mjs [small|big]  (default: big)
import { API } from '@typescript/native-preview/unstable/sync'

const target = process.argv[2] === 'small' ? 'small' : 'big'
const configFile = `tsconfig.bench.${target}.json`
const N = 50
const api = new API({ collectTiming: true })

const opened = api.updateSnapshot({ openProjects: [configFile] })
const project = opened.getProject(configFile)
if (!project) throw new Error(`project not found - check ${configFile}`)

console.log('compilerOptions:', JSON.stringify(project.compilerOptions))
console.log('rootFiles:', project.rootFiles)

const times = []
for (let i = 0; i < N; i++) {
  const start = process.hrtime.bigint()
  const diagnostics = project.program.getSemanticDiagnostics()
  const end = process.hrtime.bigint()
  times.push(Number(end - start) / 1e6)
  if (i === 0) console.log('diagnostics on first call:', diagnostics.length)
}

console.log('per-call ms:', times.map(t => t.toFixed(3)).join(', '))
console.log('first call:', times[0].toFixed(3), 'ms')
console.log('mean of calls 2..N:', (times.slice(1).reduce((a, b) => a + b, 0) / (times.length - 1)).toFixed(3), 'ms')

const timing = api.getTimingInfo()
console.log('server timing info:', JSON.stringify(timing, null, 2))

// The above almost certainly hit the language-service's diagnostic cache
// after call 1 (nothing changed between calls) - not a re-run of the
// checker. Force a genuine recheck each time via invalidateAll, still in
// the same warm process/server, to isolate real per-check cost from
// process-spawn cost (as opposed to cache-hit cost).
console.log('\n--- forcing a real recheck every call (fileChanges: invalidateAll) ---')
const forcedTimes = []
for (let i = 0; i < N; i++) {
  api.updateSnapshot({ fileChanges: { invalidateAll: true } })
  const start = process.hrtime.bigint()
  const diagnostics = project.program.getSemanticDiagnostics()
  const end = process.hrtime.bigint()
  forcedTimes.push(Number(end - start) / 1e6)
  if (i === 0) console.log('diagnostics on first forced call:', diagnostics.length)
}
console.log('forced-recheck per-call ms:', forcedTimes.map(t => t.toFixed(3)).join(', '))
console.log('forced-recheck mean:', (forcedTimes.reduce((a, b) => a + b, 0) / forcedTimes.length).toFixed(3), 'ms')

opened.dispose()
api.close()
