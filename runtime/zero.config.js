const bindings = []
const libs = []
const embeds = []
const target = 'zero' 
let link_type = '-static'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld'
if (lo.core.os === 'mac') link_type += ' -w -framework CoreFoundation'

const opt = '-O3 -march=native -mtune=native -std=c++20 -fomit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--lite-mode --jitless --single-threaded --disable-write-barriers --max-heap-size=16 --no-verify-heap --memory-reducer --optimize-for-size --stack-trace-limit=10 --use-strict --turbo-fast-api-calls'
}
const main = 'runtime/zero.js'

export default { bindings, libs, embeds, target, link_type, opt, v8_opts, main }
