const bindings = [
  'core', 
  'inflate',
  'curl',
]

const libs = [
  'lib/curl.js',
  'lib/gen.js', 
  'lib/fs.js', 
  'lib/untar.js', 
  'lib/proc.js', 
  'lib/path.js',
  'lib/curl.js',
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
