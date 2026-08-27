const bindings = ['core']
const libs = ['lib/binary.js']
const embeds = []
const target = 'snappy'
let link_type = '-static -Wl,--gc-sections -Wl,--icf=all'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld'
if (lo.core.os === 'mac') link_type = '-static-libstdc++ -w -framework CoreFoundation'

const opt = '-O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init',
  snapshot: true
}
const main = 'runtime/snappy.js'
const post_snapshot_embeds = []

export default { bindings, libs, embeds, target, link_type, opt, v8_opts, main, post_snapshot_embeds }
