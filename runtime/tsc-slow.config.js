const bindings = ['core']
const libs = ['runtime/typescript.js']
const libFiles = [
  'lib.es5.d.ts',
  'lib.decorators.d.ts',
  'lib.decorators.legacy.d.ts'
]
// Same main script as tsc.config.js (runtime/tsc.js) - only `v8_opts.snapshot`
// differs. `globalThis.snapshotEntry` is called unconditionally by lo.cc
// either way (PLAN.md task 64/68), so this is a real "parse+init the
// compiler from scratch every run" control for the three-way benchmark,
// not a different code path. See tsc.config.js for why `lib.dom.d.ts` is
// gone (replaced by `runtime/console.d.ts`, a hand-written ambient stub).
const embeds = [...libFiles.map(f => `runtime/lib/${f}`), 'small.ts', 'big.ts', 'runtime/console.d.ts']
const target = 'tsc-slow'
let link_type = '-static'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld'
if (lo.core.os === 'mac') link_type = '-static-libstdc++ -w -framework CoreFoundation'

const opt = '-O3 -std=c++20 -fomit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init',
  snapshot: false
}
const main = 'runtime/tsc.js'

export default { bindings, libs, embeds, target, link_type, opt, v8_opts, main }
