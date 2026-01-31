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
const opt = '-O3 -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation'
}

let link_type = '-rdynamic'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld -static-libgcc -static-libstdc++'
if (lo.core.os === 'mac') link_type += ' -w -framework CoreFoundation'

export default { bindings, libs, embeds, target, opt, v8_opts, link_type }
