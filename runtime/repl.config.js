const bindings = [
  'core',
  'bestlines',
  { mach: ['mac'] }
]

const libs = [
  'lib/path.js',
  'lib/stringify.js',
  'lib/proc.js', 
  'lib/ansi.js', 
  'lib/repl.js', 
  'lib/binary.js', 
]

const embeds = []
const target = 'lo-repl'
const opt = '-O3 -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--lite-mode --jitless --single-threaded --disable-write-barriers --max-heap-size=16 --no-verify-heap --no-expose-wasm --memory-reducer --optimize-for-size --stack-trace-limit=10 --use-strict'
//  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation'
}

let link_type = '-rdynamic'
if (lo.core.os === 'linux') link_type += ' -static-libgcc -static-libstdc++'

export default { bindings, libs, embeds, target, opt, v8_opts, link_type }
