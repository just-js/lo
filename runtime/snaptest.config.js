// minimal startup-snapshot runtime (see runtime/snaptest.js): no bindings, no
// libs; links like runtime/lo.config.js (musl dynamic)
const bindings = []
const libs = []
const embeds = []
const target = 'snaptest'
const opt = '-fno-pic -O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fvisibility=hidden -fno-exceptions'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --no-freeze-flags-after-init',
  snapshot: true
}
const link_type = '-static-libstdc++ -static-libgcc -fuse-ld=lld -Wl,--gc-sections -no-pie'
const link_args = ['-s', '-O3', '-fno-exceptions']
const main = 'runtime/snaptest.js'

export default { bindings, libs, embeds, target, opt, v8_opts, link_type, link_args, main }
