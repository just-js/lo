const bindings = [
  'core', 
  'inflate',
  'curl',
  'system',
  { mach: ['mac'] },
  { kevents: ['mac'] },
  { epoll: ['linux'] },
]

const libs = [
  'lib/curl.js',
  'lib/gen.js', 
  'lib/fs.js', 
  'lib/untar.js', 
  'lib/proc.js', 
  'lib/loop.js', 
  'lib/timer.js', 
  'lib/system.js', 
  'lib/path.js',
  'lib/inflate.js',
  'lib/build.js',
  'lib/stringify.js',
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
  'lib/epoll/api.js',
  'lib/kevents/api.js',
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
//  '-static-libstdc++ -static-libgcc -fuse-ld=lld -Wl,--gc-sections -Wl,--icf=all -no-pie -Wl,--dynamic-list=runtime/lo.dynlist' :
  '-rdynamic -w -framework CoreFoundation'

const link_args = ['-s', '-O3', '-fno-exceptions']

export default { bindings, libs, embeds, target, opt, v8_opts, link_type, link_args }
