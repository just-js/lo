const bindings = [
  'core'
]
const libs = []
const embeds = []
const target = 'lo'
const opt = '-O3 -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation'
}

let link_type = '-fuse-ld=lld -rdynamic'
if (lo.core.os === 'linux') link_type += ' -static-libgcc -static-libstdc++'

export default { bindings, libs, embeds, target, opt, v8_opts, link_type }
