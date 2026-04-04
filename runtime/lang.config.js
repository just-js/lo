const bindings = [
  'bestlines',
  'tcc', 
  'luajit', 
  'core',
  'net',
  'pico',
  'curl',
  'encode',
  'inflate',
  'libssl',
  'python', 
  'pthread',
  'zlib',
  'sqlite',
  'system',
  { mach: ['mac'] },
  { kevents: ['mac'] },
  { epoll: ['linux'] },
]
const libs = [
  'lib/binary.js', 
  'lib/ffi.js', 
  'lib/asm.js', 
  `lib/asm/${lo.core.arch}.js`, 
  'lib/asm/compiler.js', 
  'lib/libssl.js', 
  'lib/curl.js',
  'lib/fs.js', 
  'lib/untar.js', 
  'lib/proc.js', 
  'lib/loop.js', 
  'lib/system.js', 
  'lib/path.js',
  'lib/inflate.js',
  'lib/stringify.js',
  'lib/zlib.js',
  'lib/thread.js',
  'lib/sqlite.js',
  'lib/repl.js',
  'lib/net.js',
  'lib/timer.js',
  'lib/hash.js',
  'lib/pico.js',
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

const embeds = []
const target = 'lang' 
let link_type = '-static'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld'
if (lo.core.os === 'mac') link_type = '-static-libstdc++ -w -framework CoreFoundation'

const opt = '-O3 -std=c++20 -fomit-frame-pointer -fno-rtti -fno-exceptions'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation'
}

export default { bindings, libs, embeds, target, link_type, opt, v8_opts }
