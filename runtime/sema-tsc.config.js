// sema-tsc: a TypeScript type checker runtime. Bun's checker (`sema` binding, lib/sema) plus a tsc-like CLI as the
// index (runtime/sema-tsc.js). Links like runtime/lo.config.js (musl dynamic, static libstdc++): a fully static lo
// with the full V8 crashed with heap corruption under load (repos/lo HouseKeeping, 2026-10-14).
const bindings = ['core', 'sema']
const libs = []
const embeds = []
const target = 'sema-tsc'
const opt = '-fno-pic -O3 -ffunction-sections -fdata-sections -march=native -mtune=native -std=c++20 -c -fno-omit-frame-pointer -fno-rtti -fvisibility=hidden -fno-exceptions'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init'
}

const link_type = '-static-libstdc++ -static-libgcc -fuse-ld=lld -Wl,--gc-sections -Wl,--icf=all -no-pie'

const index = 'runtime/sema-tsc.js'
const link_args = ['-s', '-O3', '-fno-exceptions']
const v8 = 'mini'

export default {
  bindings, libs, embeds, target, opt, v8_opts, link_type, index, link_args, v8
}
