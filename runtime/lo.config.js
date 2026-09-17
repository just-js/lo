const bindings = [
  'bestlines',
  'core', 
  'curl',
  'encode',
  'inflate',
  'libssl',
  'net',
  'pico',
  'pthread',
  'sqlite',
  'system',
  { 'epoll': ['linux'] },
  { 'kevents': ['mac'] },
  { 'mach': ['mac'] },
  'zlib'
]

const libs = [
  'lib/bench.js', 
  'lib/binary.js', 
  'lib/ffi.js', 
  'lib/asm.js', 
  `lib/asm/${lo.core.arch}.js`, 
  'lib/asm/compiler.js', 
  'lib/gen.js', 
  'lib/fs.js', 
  'lib/untar.js', 
  'lib/proc.js', 
  'lib/libssl.js', 
  'lib/path.js',
  'lib/curl.js',
  'lib/inflate.js',
  'lib/build.js',
  'lib/stringify.js',
  'lib/zlib.js',
  'lib/repl.js',
  'lib/system.js',
  'lib/thread.js',
  'lib/sqlite.js',
  'lib/timer.js',
  'lib/net.js',
  'lib/hash.js',
  'lib/binary.js',
  'lib/loop.js',
  'lib/pico.js',
  'lib/worker.js',
  'lib/udp.js',
  'lib/pmon.js',
  'lib/dns.js',
  'lib/dns/protocol.js',
  'lib/socket.js',
  'lib/packet.js',
  'lib/sni.js',
  'lib/html.js',
  'lib/ansi.js',
  'lib/elf.js',
]

const embeds = [
  'main.cc',
  'main.h',
  'lo.h',
  'lo.cc',
  'lib/inflate/api.js',
  'lib/inflate/build.js',
  'lib/core/api.js',
  'lib/curl/api.js',
  'lib/system/api.js',
  'lib/cfzlib/api.js',
  'lib/cfzlib/build.js',
  'lib/libssl/api.js',
  'lib/libssl/build.js',
  'lib/bestlines/api.js',
  'lib/bestlines/build.js',
  'lib/pthread/api.js',
  'lib/sqlite/api.js',
  'lib/sqlite/build.js',
  'lib/encode/api.js',
  'runtime/core.config.js',
  'runtime/base.config.js',
  'runtime/lo.config.js',
  'globals.d.ts',
]


const target = 'lo'
const opt = '-fno-pic -O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fvisibility=hidden -fno-exceptions'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init'
}

const link_type = lo.core.os === 'linux' ? 
  '-static-libstdc++ -static-libgcc -fuse-ld=lld -Wl,--gc-sections -Wl,--icf=all -no-pie' :
  '-rdynamic -w -framework CoreFoundation'

const link_args = ['-s', '-O3', '-fno-exceptions']

export default { bindings, libs, embeds, target, opt, v8_opts, link_type, link_args }
