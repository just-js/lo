const bindings = [
  'core', 
  'fsmount',
  'sqlite',
  'net',
  'epoll',
  'pico',
  'system'
]
const libs = [
  'lib/ansi.js', 
  'lib/proc.js', 
  'lib/path.js', 
  'lib/net.js', 
  'lib/loop.js', 
  'lib/stringify.js', 
  'lib/binary.js',
  'lib/bench.js',
  'lib/timer.js',
  'lib/pico.js'
]
const embeds = []
const target = 'init'
const opt = '-O3 -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init'
}
let link_type = '-static -fuse-ld=lld'

const index = 'runtime/init.js'

export default { 
  bindings, libs, embeds, target, opt, v8_opts, link_type, index
}
