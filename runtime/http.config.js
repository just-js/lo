// HTTP/1.1 server runtime for hello-lo.js (LO-HTTP-CONFORMANCE.md in the
// mother repo). bindings and libs from lib/parse.js:
//   LO_CACHE=1 ./lo $PWD/test/parse-test.js hello-lo.js
// build against the full V8 (TurboFan: lo's Fast API calls need it):
//   LO_V8_LIB=./v8/libv8_monolith-full.a ./lo build runtime $PWD/runtime/http
// (lib/build.js copies LO_V8_LIB over v8/libv8_monolith.a: copy the mini
// archive back afterwards)
const bindings = [
  'core',
  'net',
  'pico',
  'chunked',
  { 'epoll': ['linux'] },
  { 'system': ['linux'] },
  { 'kevents': ['mac'] },
  { 'mach': ['mac'] },
]
const libs = [
  'lib/net.js',
  'lib/loop.js',
  'lib/stats.js',
  'lib/timer.js',
  'lib/pico.js',
  'lib/proc.js',
]
const embeds = []
const target = 'lo-http'
const opt = '-fno-pic -O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fvisibility=hidden -fno-exceptions'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init'
}
// musl linked dynamically, like runtime/lo.config.js: the fully static
// link (-static, as in echo-server.config.js) crashed under Http11Probe
// with heap corruption found by mallocng in V8's ArrayBuffer sweeper (3 of
// 7 runs; 0 of 12 linked like this). LO-HTTP-CONFORMANCE.md in the mother repo
const link_type = '-static-libstdc++ -static-libgcc -fuse-ld=lld -Wl,--gc-sections -Wl,--icf=all -no-pie'

const index = 'hello-lo.js'
const link_args = ['-s', '-O3', '-fno-exceptions']

export default {
  bindings, libs, embeds, target, opt, v8_opts, link_type, index, link_args
}
