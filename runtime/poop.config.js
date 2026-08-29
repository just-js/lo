const bindings = ['core']
const libs = [
  'lib/asm.js',
  'lib/asm/compiler.js',
  'lib/asm/x64.js',
  'lib/ffi.js'
]

const embeds = []
const target = 'poop'
let link_type = '-rdynamic -Wl,--gc-sections -Wl,--icf=all'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld -static-libstdc++ -static-libgcc'
if (lo.core.os === 'mac') link_type = '-static-libstdc++ -w -framework CoreFoundation'

let opt = '-O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init',
}
const index = 'runtime/poop.js'

export default { bindings, libs, embeds, target, link_type, opt, v8_opts, index }
