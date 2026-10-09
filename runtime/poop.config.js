const bindings = ['core']
const libs = [
  'lib/ffi.js',
  'lib/asm.js',
  'lib/asm/compiler.js',
  'lib/asm/x64.js',
]
const embeds = []
const target = 'poop' 
let link_type = '-static-libstdc++ -static-libgcc'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld -Wl,--gc-sections -Wl,--icf=all -no-pie'
if (lo.core.os === 'mac') link_type = '-static-libstdc++ -w -framework CoreFoundation'
const opt = '-fno-pic -O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fvisibility=hidden -fno-exceptions'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init'
}
const index = 'runtime/poop.js'
const link_args = ['-s', '-O3', '-fno-exceptions']
export default { bindings, libs, embeds, target, link_type, opt, v8_opts, index, link_args }
