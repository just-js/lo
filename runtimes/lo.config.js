const { core } = lo
const { os } = core

const bindings = [
  'bestlines',
//  'cfzlib',
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
//  'lz4',  
]

if (os === 'linux') {
  bindings.push('epoll')
} else if (os === 'mac') {
  bindings.push('kevents')
  bindings.push('mach')
}

const libs = [
  'lib/bench.js', 
  'lib/binary.js', 
  'lib/curl.js',
  'lib/ffi.js', 
  'lib/asm.js', 
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
  'lib/bench.mjs',
  'lib/dns/dns.js',
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
  'runtimes/core.config.js',
  'runtimes/base.config.js',
  'runtimes/lo.config.js',
  'globals.d.ts',
]


const target = 'lo'
const opt = '-O3 -march=native -mtune=native'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation'
}

let link_type = '-rdynamic -static-libstdc++'
if (lo.core.os === 'linux') link_type += ' -static-libgcc'

export default { bindings, libs, embeds, target, opt, v8_opts, link_type }
