const bindings = []
const libs = []
const embeds = []
const target = 'zero' 
const link_type = lo.core.os === 'linux' ? 
  '-static-libstdc++ -static-libgcc -fuse-ld=lld -Wl,--gc-sections -Wl,--icf=all -no-pie' :
  '-rdynamic -w -framework CoreFoundation'
const opt = '-fno-pic -O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fvisibility=hidden -fno-exceptions'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--lite-mode --jitless --single-threaded --disable-write-barriers --max-heap-size=16 --no-verify-heap --memory-reducer --optimize-for-size --stack-trace-limit=10 --use-strict --turbo-fast-api-calls'
}
const main = 'runtime/zero.js'
const link_args = ['-s', '-O3', '-fno-exceptions']
export default { bindings, libs, embeds, target, link_type, opt, v8_opts, main, link_args }
