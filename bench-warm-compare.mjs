// Side-by-side "stay warm, repeat the check" comparison: lo's own
// from-scratch repeated-compile loop (./tsc2) vs. tsgo's persistent-server
// API doing genuine, verified per-edit rechecks (bench-tsgo-api-edit.mjs,
// `incremental` mode only - see that file for why `full` mode is excluded
// here). See LO-TYPESCRIPT.md sections 19-20 for the full writeup and the
// real bugs that made an earlier version of this comparison wrong by
// ~150x, plus a real sandbox lockup during that investigation.
//
// HOW TO RUN:
//   node bench-warm-compare.mjs [small|big] [iterations|Ns] [cpulist]
//
//   target     - "small" or "big" (default: big)
//   spec       - a plain count ("200") or a duration ("30s") - both
//                sides are run with the same spec, so they're directly
//                comparable regardless of either side's per-pass speed
//                (default: 30s)
//   cpulist    - passed straight to `taskset -c` for BOTH sides, e.g.
//                "0" to peg a single core (rules out any parallelism
//                advantage on either side), "0,1" for two, "0-3" for all
//                four on this machine (default: 0 - single core)
//
// Examples:
//   node bench-warm-compare.mjs big 30s 0        # single core, 30s each
//   node bench-warm-compare.mjs big 30s 0,1       # two cores, 30s each
//   node bench-warm-compare.mjs small 500 0-3     # all four cores, fixed count
//
// SAFETY: always goes through `taskset -c <cpulist>` for both sides -
// never invoke ./tsc2 or bench-tsgo-api-edit.mjs directly unpinned. See
// LO-TYPESCRIPT.md section 20 for why (a real sandbox lockup).
import { execFileSync } from 'node:child_process'

const target = process.argv[2] === 'small' ? 'small' : 'big'
const spec = process.argv[3] || '30s'
const cpulist = process.argv[4] || '0'
const file = `${target}.ts`

function run (label, cmd, args) {
  console.log(`=== ${label} ===`)
  const output = execFileSync('taskset', ['-c', cpulist, cmd, ...args], { encoding: 'utf8' })
  console.log(output.trim())
  console.log()
  return output
}

const loOutput = run(`lo (./tsc2), ${spec}, taskset -c ${cpulist}`, './tsc2', [file, spec])
const tsgoOutput = run(`tsgo (persistent server, incremental mode), ${spec}, taskset -c ${cpulist}`, 'node', ['bench-tsgo-api-edit.mjs', target, spec, 'incremental'])

function parseStats (label, text) {
  const m = text.match(/mean: ([\d.]+)ms\s+min: ([\d.]+)ms\s+p50: ([\d.]+)ms\s+p75: ([\d.]+)ms\s+p90: ([\d.]+)ms\s+p99: ([\d.]+)ms\s+max: ([\d.]+)ms/)
  if (!m) {
    console.error(`Could not parse stats from ${label} output - skipping it in the summary table.`)
    return null
  }
  const [, mean, min, p50, p75, p90, p99, max] = m
  return { mean, min, p50, p75, p90, p99, max }
}

const lo = parseStats('lo', loOutput)
const tsgo = parseStats('tsgo', tsgoOutput)

if (lo && tsgo) {
  console.log(`=== Summary (target=${target}, spec=${spec}, cpulist=${cpulist}) ===`)
  console.log('| | mean | p50 | p75 | p90 | p99 |')
  console.log('|---|---:|---:|---:|---:|---:|')
  console.log(`| lo (tsc2), full recompile every pass | ${lo.mean}ms | ${lo.p50}ms | ${lo.p75}ms | ${lo.p90}ms | ${lo.p99}ms |`)
  console.log(`| tsgo, persistent server, verified real edit | ${tsgo.mean}ms | ${tsgo.p50}ms | ${tsgo.p75}ms | ${tsgo.p90}ms | ${tsgo.p99}ms |`)
}
