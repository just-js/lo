const bindings = [
  'core', 
  'net',
  'epoll',
  'system',
]
const libs = [
  'lib/net.js',
  'lib/loop.js',
  'lib/timer.js',
  'lib/bench.js',
  'lib/proc.js',
]
const embeds = []
const target = 'echo-server'
const opt = '-fno-pic -O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fvisibility=hidden -fno-exceptions'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init'
}
const link_type = '-static -fuse-ld=lld -Wl,--gc-sections -Wl,--icf=all -s'

const index = 'runtime/echo-server.js'
const link_args = ['-s', '-O3', '-fno-exceptions']
const v8 = 'mini'

export default {
  bindings, libs, embeds, target, opt, v8_opts, link_type, index, link_args, v8
}
