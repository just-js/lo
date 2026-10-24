// sema-tsc: type checks a TypeScript project with Bun's checker (`bun check`), linked in as the `sema` binding.
//
//   sema-tsc [-p <tsconfig.json or dir>] [--checkers <n> | --singleThreaded | --threads <n>] [--lib <dir>]
//            [--diagnostics] [--timing] [--json]
//
// TypeScript 7.0.2's lib.*.d.ts files are built in, as in `bun check`; --lib (or SEMA_TS_LIB) reads another set from
// a directory. Prints the diagnostics like `tsc --pretty false` and exits 1 when there are errors. --json prints the
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

const project_c = cstr(project)
// No --lib: a null pointer, which selects the built-in libs.
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
