const bindings = ['core']
const libs = ['main.js']
const embeds = []
const target = 'snap-slow' 
let link_type = '-static'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld'
if (lo.core.os === 'mac') link_type = '-static-libstdc++ -w -framework CoreFoundation'

const opt = '-g -O3 -std=c++20 -fomit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init',
  snapshot: false
}
const main = 'runtime/snap/snap.js'
const link_args = ['-fno-exceptions', '-O3']

export default { bindings, libs, embeds, target, link_type, opt, v8_opts, main, link_args }
