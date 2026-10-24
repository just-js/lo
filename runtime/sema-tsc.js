// sema-tsc: type checks a TypeScript project with Bun's checker (`bun check`), linked in as the `sema` binding.
//
//   sema-tsc [-p <tsconfig.json or dir>] [--checkers <n> | --singleThreaded | --threads <n>] [--lib <dir>]
//            [--diagnostics] [--timing] [--json]
//
// TypeScript 7.0.2's lib.*.d.ts files are built in, as in `bun check`; lib files embedded in the runtime replace them
// (runtime/sema-custom.config.js); --lib (or SEMA_TS_LIB) reads another set from a directory. Prints the diagnostics like `tsc --pretty false` and exits 1 when there are errors. --json prints the
// raw report. For benchmarks next to tsc/tsgo/tsrs (repos/tsrs-bench), it takes their command line: --noEmit,
// --incremental <v> and --pretty <v> are accepted and ignored (it never emits, and prints plain output), --checkers
// <n> and --singleThreaded set the thread count (default: one per core it may run on), and --diagnostics prints
// tsc-style "Parse time" (loading), "Check time" and "Total time" lines.
const { cstr, ptr, utf8_decode, getenv, args } = lo

const { sema } = lo.load('sema')

function usage (message) {
  if (message) console.error(`sema-tsc: ${message}`)
  console.error('usage: sema-tsc [-p <tsconfig.json or dir>] [--checkers <n> | --singleThreaded | --threads <n>] [--lib <dir>] [--diagnostics] [--timing] [--json]')
  lo.exit(2)
}

let project = '.'
let threads = 0
let lib_dir = getenv('SEMA_TS_LIB')
let timing = false
let diagnostics = false
let json = false
const argv = args.slice(1)
// A tsc boolean flag's optional value (`--pretty false`, `--incremental true`).
const skip_boolean = i => (argv[i + 1] === 'true' || argv[i + 1] === 'false') ? i + 1 : i
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  if (arg === '-p' || arg === '--project') project = argv[++i]
  else if (arg === '--threads' || arg === '--checkers') threads = Number(argv[++i])
  else if (arg === '--singleThreaded') threads = 1
  else if (arg === '--lib') lib_dir = argv[++i]
  else if (arg === '--timing') timing = true
  else if (arg === '--diagnostics' || arg === '--extendedDiagnostics') diagnostics = true
  else if (arg === '--json') json = true
  else if (arg === '--noEmit' || arg === '--incremental' || arg === '--pretty') i = skip_boolean(i)
  else if (arg.startsWith('--pretty=') || arg.startsWith('--incremental=')) continue
  else if (arg === '-h' || arg === '--help') usage()
  else usage(`unknown argument ${arg}`)
}
if (!project) usage('-p needs a value')
if (!Number.isInteger(threads) || threads < 0) usage('--threads/--checkers needs a whole number')

// lib.*.d.ts files embedded in the runtime (a config's `embeds`, e.g. runtime/sema-custom.config.js) replace the
// built-in set: only they then exist for the checker. Registered with sema.set_libs, which borrows: the texts are the
// embedded bytes themselves (lo.builtin(path, false), no copy), the names C strings kept in `registered` for the
// life of the process. --lib (a directory) still takes precedence.
const registered = []
const embedded_libs = lo.builtins().filter(path => /(^|\/)lib\.[^/]+\.d\.ts$/.test(path))
if (embedded_libs.length && !lib_dir) {
  const count = embedded_libs.length
  const names = new BigUint64Array(count)
  const texts = new BigUint64Array(count)
  const lens = new BigUint64Array(count)
  embedded_libs.forEach((path, i) => {
    const name = cstr(path.slice(path.lastIndexOf('/') + 1))
    const text = ptr(new Uint8Array(lo.builtin(path, false)))
    registered.push(name, text)
    names[i] = BigInt(name.ptr)
    texts[i] = BigInt(text.ptr)
    lens[i] = BigInt(text.length)
  })
  const status = sema.set_libs(ptr(new Uint8Array(names.buffer)).ptr, ptr(new Uint8Array(texts.buffer)).ptr,
    ptr(new Uint8Array(lens.buffer)).ptr, count)
  if (status !== 0) {
    console.error(`sema-tsc: registering the ${count} embedded lib files failed (${status})`)
    lo.exit(2)
  }
}

const project_c = cstr(project)
// No --lib: a null pointer, which selects the registered (embedded) libs, else the built-in ones.
const lib_c = lib_dir ? cstr(lib_dir) : null
const len = ptr(new Uint8Array(8))

const start = lo.hrtime()
// Generated bindings take buffers (here the size_t* out parameter) as addresses, and return the pointer directly.
const report_ptr = sema.check(project_c.ptr, lib_c ? lib_c.ptr : 0, threads, len.ptr)
const call_ms = Number(lo.hrtime() - start) / 1e6
const text = utf8_decode(report_ptr, Number(new BigUint64Array(len.buffer)[0]))
sema.free(report_ptr)

if (json) {
  console.log(text)
} else {
  const report = JSON.parse(text)
  if (report.output) console.log(report.output.trimEnd())
  if (diagnostics) {
    const s = ms => `${(ms / 1000).toFixed(2)}s`
    console.log(`Files:        ${report.files_loaded}`)
    console.log(`Parse time:   ${s(report.load_ms)}`)
    console.log(`Check time:   ${s(report.check_ms)}`)
    console.log(`Total time:   ${s(report.load_ms + report.check_ms)}`)
  }
  if (timing) {
    console.error(`files loaded ${report.files_loaded} in ${report.load_ms.toFixed(1)}ms, checked ${report.files_checked} in ${report.check_ms.toFixed(1)}ms, call ${call_ms.toFixed(1)}ms`)
  }
  if (!report.ok) lo.exit(1)
}
