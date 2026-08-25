// Fork of runtime/tsc.js with one addition: snapshotEntry's second
// command-line arg, if > 1, repeats the full compile N times in this one
// warm process, timing each pass with the raw lo.hrtime/lo.getAddress
// idiom (same as runtime/zero-snap.js/big.js) - measures whatever effect a
// warm V8 isolate/JIT has on repeated full-compile cost, separate from
// process-spawn cost. See LO-TYPESCRIPT.md section 19; runtime/tsc.js has
// the plain, single-pass version this was forked from.

function read_file (path, flags = defaultReadFlags, size = 0) {
  const fd = open(path, flags)
  assert(fd > 0, `failed to open ${path} with flags ${flags}`)
  if (size === 0) {
    assert(fstat(fd, stat.ptr) === 0)
    if (core.os === 'mac') {
      size = Number(st[12])
    } else if (core.os === 'win') {
      size = stat32[5]
    } else {
      size = Number(st[6])
    }
  }
  let off = 0
  let len = 0
  // todo - check for max size
  const u8 = ptr(new Uint8Array(size))
  while ((len = read(fd, u8.ptr, size - off)) > 0) off += len
  close(fd)
  return u8
}

function require (file_path) {
  if (requireCache.has(file_path)) {
    return requireCache.get(file_path).exports
  }
  const src = lo.builtin(file_path)
  const f = new Function('exports', 'module', 'require', src)
  const mod = { exports: {} }
  f.call(globalThis, mod.exports, mod, require)
  requireCache.set(file_path, mod)
  return mod.exports
}

// https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

const requireCache = new Map()
globalThis.ts = require('runtime/typescript.js')

// The two files this whole CompilerHost is hardcoded against - see
// PLAN.md task 68. No fs/module resolution: neither has imports, so
// nothing beyond `getSourceFile`/`fileExists`/`readFile` for these known
// names is needed, and `ts.sys` doesn't exist under `lo` anyway (it's
// only populated by typescript.js's own getNodeSystem(), which requires a
// Node-like host `lo` doesn't emulate). Which one gets checked is chosen
// per invocation, in snapshotEntry, via the first real command-line arg -
// both are embedded, so either choice is free to fetch, but only the
// chosen one gets parsed (that's the actual per-invocation cost being
// measured, same as when there was only one target file).
const TARGET_FILES = {
  'small.ts': lo.builtin('small.ts'),
  'big.ts': lo.builtin('big.ts')
}
const DEFAULT_TARGET = 'small.ts'

// `lib.dom.d.ts` (2.35MB) was only ever needed for one thing: `console`,
// the only global `one.ts` uses beyond plain ES5. `console` isn't part of
// ECMAScript - it's a host global, and TypeScript's shipped lib set only
// declares it inside the *entire* DOM API surface (or `lib.webworker.d.ts`,
// an alternate, equally non-default lib) - there's no "just console"
// option. So instead: explicit `lib: ['lib.es5.d.ts']`, plus a one-line
// hand-written ambient `console` declaration (`runtime/console.d.ts`)
// added as a second root file, not a "lib" - confirmed 0 diagnostics
// against real tsc 6.0.3 (PLAN.md task 68).
const compilerOptions = {
  target: ts.ScriptTarget.ES2015,
  lib: ['lib.es5.d.ts'],
  noEmit: true
}
const CONSOLE_FILE = 'console.d.ts'

// Kept in sync with tsc.config.js's `libFiles` list by hand for now - this
// file has no `import`, so it can't share the array directly.
const LIB_FILES = [
  'lib.es5.d.ts',
  'lib.decorators.d.ts',
  'lib.decorators.legacy.d.ts'
]

// Parsed once, here, at module top level - this runs during the snapshot
// *build* pass too (definitions-only phase, same convention as
// runtime/zero-snap.js/runtime/big.js), so restoring the snapshot gets
// these already-parsed SourceFiles for free. `console.d.ts` is static
// (like the real lib files) so it's parsed here too, not per-invocation.
// Only `one.ts` itself gets parsed per invocation, in snapshotEntry below -
// that's the actual per-run cost being measured.
const libSourceFiles = new Map([
  ...LIB_FILES.map(name => [
    name,
    ts.createSourceFile(name, lo.builtin(`runtime/lib/${name}`), compilerOptions.target)
  ]),
  [CONSOLE_FILE, ts.createSourceFile(CONSOLE_FILE, lo.builtin('runtime/console.d.ts'), compilerOptions.target)]
])

const defaultLibFileName = ts.getDefaultLibFileName(compilerOptions)

function createCompilerHost(rootFile) {
  return {
    getSourceFile,
    getDefaultLibFileName: () => defaultLibFileName,
    writeFile: () => {},
    getCurrentDirectory: () => '',
    getDirectories: () => [],
    getCanonicalFileName: fileName => fileName,
    getNewLine: () => '\n',
    useCaseSensitiveFileNames: () => true,
    fileExists,
    readFile
  };

  function fileExists(fileName) {
    return libSourceFiles.has(fileName) || fileName === rootFile
  }

  function readFile(fileName) {
    if (libSourceFiles.has(fileName)) return libSourceFiles.get(fileName).text
    if (fileName === rootFile) return TARGET_FILES[rootFile]
  }

  function getSourceFile(fileName) {
    const cached = libSourceFiles.get(fileName)
    if (cached) return cached
    if (fileName === rootFile) return ts.createSourceFile(fileName, TARGET_FILES[rootFile], compilerOptions.target)
  }
}

function compile(rootFile) {
  return ts.createProgram([rootFile, CONSOLE_FILE], compilerOptions, createCompilerHost(rootFile))
}

globalThis.tsc = {
  compile
}

// Raw nanosecond timer - same idiom as runtime/zero-snap.js/big.js. `handle`
// is declared here (safe - no native call yet) but `get_address`/`hrtime`
// are only ever called from inside snapshotEntry, post-restore, same as
// those scripts: calling them during the snapshot *build* pass would touch
// a fast-call native site before the freeze point (V8-SNAPSHOT.md).
function addr (u32) {
  return u32[0] + ((2 ** 32) * u32[1])
}

function get_address (buf) {
  lo.getAddress(buf, handle)
  return addr(handle)
}

function hrtime () {
  lo.hrtime(handle.ptr)
  return addr(handle)
}

const handle = new Uint32Array(2)

// Initial implementation (PLAN.md task 68): assume the hardcoded input is
// always valid TypeScript, so the only thing that matters is a correct
// exit code - no diagnostics formatting.
//
// Second arg, if present and > 1: repeat the full compile (fresh
// ts.createProgram + diagnostics, from scratch, every pass - there is no
// incremental/caching mechanism here, unlike tsgo's language-service API
// in LO-TYPESCRIPT.md section 17.12) N times in this one warm process,
// timing each pass. Isolates whatever effect a warm V8 isolate/JIT has on
// repeated full-compile cost from process-spawn cost - see section 18/19.
// Standardized stats format - kept identical (field names, order, decimal
// places) to bench-tsgo-api-edit.mjs's summary line, so the two can be
// compared directly without mentally reformatting one of them. See
// bench-warm-compare.sh, which runs both and prints them back to back.
function summarize (timesMs) {
  const sorted = timesMs.slice().sort((a, b) => a - b)
  const sum = timesMs.reduce((a, b) => a + b, 0)
  const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
  return `mean: ${(sum / timesMs.length).toFixed(3)}ms  min: ${sorted[0].toFixed(3)}ms  p50: ${pct(0.5).toFixed(3)}ms  p75: ${pct(0.75).toFixed(3)}ms  p90: ${pct(0.9).toFixed(3)}ms  p99: ${pct(0.99).toFixed(3)}ms  max: ${sorted[sorted.length - 1].toFixed(3)}ms`
}

// Second arg: either a plain count ("100") or a duration ("30s") - the
// latter loops until that much wall-clock time has elapsed instead of a
// fixed number of passes, so runs are directly comparable to
// bench-tsgo-api-edit.mjs's own duration mode regardless of either side's
// per-pass speed. See bench-warm-compare.sh.
function parseIterationsArg (raw) {
  const durationMatch = /^(\d+)s$/.exec(raw || '')
  if (durationMatch) return { mode: 'duration', durationMs: parseInt(durationMatch[1], 10) * 1000 }
  return { mode: 'count', count: Math.max(1, parseInt(raw, 10) || 1) }
}

globalThis.snapshotEntry = function () {
  try {
    const arg = lo.args[1]
    const rootFile = Object.prototype.hasOwnProperty.call(TARGET_FILES, arg) ? arg : DEFAULT_TARGET
    const spec = parseIterationsArg(lo.args[2])
    handle.ptr = get_address(handle)
    let diagnosticsCount = 0
    if (spec.mode === 'count' && spec.count === 1) {
      const program = compile(rootFile)
      diagnosticsCount = ts.getPreEmitDiagnostics(program).length
    } else {
      const timesMs = []
      const loopStart = hrtime()
      while (spec.mode === 'duration' ? (hrtime() - loopStart) / 1e6 < spec.durationMs : timesMs.length < spec.count) {
        const start = hrtime()
        const program = compile(rootFile)
        diagnosticsCount = ts.getPreEmitDiagnostics(program).length
        timesMs.push((hrtime() - start) / 1e6)
      }
      lo.print(`iterations: ${timesMs.length}\n`)
      lo.print(`${summarize(timesMs)}\n`)
      lo.print(`first 10 (raw temporal order): ${timesMs.slice(0, 10).map(t => t.toFixed(3)).join(', ')}\n`)
      lo.print(`last 10 (raw temporal order, drift check): ${timesMs.slice(-10).map(t => t.toFixed(3)).join(', ')}\n`)
    }
    lo.exit(diagnosticsCount ? 1 : 0)
  } catch (err) {
    lo.print(`${err.stack}\n`)
    lo.exit(1)
  }
}