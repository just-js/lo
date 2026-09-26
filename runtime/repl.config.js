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
const opt = '-fno-pic -O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fvisibility=hidden -fno-exceptions'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 0, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init'
}

const link_type = lo.core.os === 'linux' ? 
  '-static -fuse-ld=lld -Wl,--gc-sections -Wl,--icf=all' :
  '-rdynamic -w -framework CoreFoundation'
const index = 'runtime/repl.js'
const link_args = ['-s', '-O3', '-fno-exceptions']

export default { bindings, libs, embeds, target, opt, v8_opts, link_type, index, link_args }
