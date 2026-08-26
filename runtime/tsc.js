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

// oldProgram reuse (PLAN.md task 68 / LO-TYPESCRIPT.md section 21):
// ts.createProgram's real, public 4th argument. libSourceFiles/CONSOLE_FILE
// are the exact same cached SourceFile objects on every call (never
// recreated), so passing the previous Program back in lets TypeScript's own
// structural-reuse logic recognize those files as unchanged and skip
// re-binding/re-checking them - only the root file (a fresh SourceFile
// every call, by design, since it represents "what actually changed") gets
// redone. Without this, every single call was fully rebinding and
// rechecking the cached libs from scratch too, not just re-parsing the
// root file as earlier notes in this codebase incorrectly assumed.
let previousProgram

function compile(rootFile) {
  const program = ts.createProgram([rootFile, CONSOLE_FILE], compilerOptions, createCompilerHost(rootFile), previousProgram)
  previousProgram = program
  return program
}

globalThis.tsc = {
  compile
}

// Initial implementation (PLAN.md task 68): assume the hardcoded input is
// always valid TypeScript, so the only thing that matters right now is a
// correct exit code - no diagnostics formatting yet.
//
// A repeated-in-process-pass variant of this same file (timing loop, for
// measuring V8 JIT warmup effects on repeated full compiles) lives
// separately as runtime/tsc2.js/tsc2.config.js - kept as its own checked-in
// target rather than folded into this one. See LO-TYPESCRIPT.md section 19.
globalThis.snapshotEntry = function () {
  try {
    const arg = lo.args[1]
    const rootFile = Object.prototype.hasOwnProperty.call(TARGET_FILES, arg) ? arg : DEFAULT_TARGET
    const program = compile(rootFile)
    const diagnostics = ts.getPreEmitDiagnostics(program)
    lo.exit(diagnostics.length ? 1 : 0)
  } catch (err) {
    lo.print(`${err.stack}\n`)
    lo.exit(1)
  }
}