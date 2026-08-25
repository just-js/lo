const bindings = ['core']
const libs = ['runtime/typescript.js']
const libFiles = [
  'lib.es5.d.ts',
  'lib.decorators.d.ts',
  'lib.decorators.legacy.d.ts'
]
// `lib.dom.d.ts` (2.35MB, ~2.66MB total with its own reference chain) was
// only ever needed for one thing: `console`, the only global `one.ts`
// actually uses beyond plain ES5. `console` isn't part of ECMAScript - it's
// a host global, and TypeScript's shipped lib set only declares it inside
// the *entire* DOM API surface (or `lib.webworker.d.ts`, an alternate,
// equally non-default lib) - there's no "just console" option. Confirmed
// directly against real tsc 6.0.3: dropping `lib.dom.d.ts` for a one-line
// hand-written ambient `console` declaration (`runtime/console.d.ts`,
// registered as a second root file, not a "lib") gets 0 diagnostics with
// only `lib.es5.d.ts` + its own small decorators refs - 233KB total instead
// of 2.66MB. See PLAN.md task 68. `one.ts` itself is embedded too, so the
// CompilerHost never needs real fs access.
const embeds = [...libFiles.map(f => `runtime/lib/${f}`), 'small.ts', 'big.ts', 'runtime/console.d.ts']
const target = 'tsc2'
let link_type = '-static'
if (lo.core.os === 'linux') link_type += ' -fuse-ld=lld'
if (lo.core.os === 'mac') link_type = '-static-libstdc++ -w -framework CoreFoundation'

const opt = '-O3 -std=c++20 -fomit-frame-pointer -fno-rtti -fno-exceptions -fvisibility=hidden'
const v8_opts = {
  v8_cleanup: 0, v8_threads: 1, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init',
  snapshot: true
}
const main = 'runtime/tsc2.js'

export default { bindings, libs, embeds, target, link_type, opt, v8_opts, main }
