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
]

const libs = [
  'lib/bench.js', 
  'lib/binary.js', 
  'lib/curl.js',
  'lib/ffi.js', 
  'lib/asm.js', 
  'lib/asm/assembler.js', 
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
  'lib/bench.mjs',
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
const opt = '-O3 -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init'
//  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --max-heap-size 1024'
}

let link_type = '-rdynamic'
if (lo.core.os === 'linux') link_type += ' -static-libgcc -static-libstdc++'

export default { bindings, libs, embeds, target, opt, v8_opts, link_type }

/*
1996  CXX="ccache g++" CC="ccache gcc" LINK="mold -run g++" LO_CACHE=1 lo build runtime runtime/lo -v
 1997  CXX="ccache g++" CC="ccache gcc" LO_CACHE=1 lo build runtime runtime/lo -v
 1998  objcopy --only-keep-debug lo lo.debug
 1999  strip --strip-debug --strip-unneeded lo
 2000  objcopy --add-gnu-debuglink=./lo.debug lo
 2001  rm core.*
 2002  ./lo eval "lo.ptr()"
 2003  lldb ./lo -c core.267100 
 2004  lldb-16 ./lo -c core.267100 
 2005  gdb --help
 2006  ll
 2007  gdb ./lo -c core.267100 
 2008  gold
 2009  history
*/
