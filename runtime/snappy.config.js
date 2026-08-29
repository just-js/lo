const bindings = ['core']
const libs = [
  'lib/binary.js',
  'lib/path.js',
  'lib/stringify.js',
  'lib/proc.js',
  'lib/ansi.js',
  'lib/bench.js',
]

const is_debug_build = lo.getenv('DEBUG_BUILD') === '1'
const embeds = []
const target = 'snappy'
let link_type = '-rdynamic -Wl,--gc-sections'
if (is_debug_build) link_type += ' -Wl,--icf=all'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld -static-libstdc++ -static-libgcc'
if (lo.core.os === 'mac') link_type = '-static-libstdc++ -w -framework CoreFoundation'

let opt = '-O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'
if (is_debug_build) {
  opt += ' -f -O0'
}
const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init',
  snapshot: true
}
const main = 'runtime/snappy.js'
const post_snapshot_embeds = []
let link_args = undefined
if (is_debug_build) {
  link_args = ['-fno-exceptions']
}

export default { bindings, libs, embeds, target, link_type, opt, v8_opts, main, post_snapshot_embeds, link_args }
