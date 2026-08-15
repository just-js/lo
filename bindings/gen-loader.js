// node:module customization hook, registered by gen-module.js only when
// running under plain `node`. `lo`'s own module loader resolves bare
// `lib/*.js` specifiers against the process's CWD (not against the
// importing file's own location, unlike standard ESM relative-import
// chaining) - this hook gives `node` the same CWD-rooted resolution for
// the same specifiers, so lib/gen.js and every api.js can use plain
// `lib/*.js` imports unmodified under either runtime, invoked from
// repos/lo's root either way.
import { pathToFileURL } from 'node:url'

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('lib/')) {
    return { url: pathToFileURL(`${process.cwd()}/${specifier}`).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
