// Regenerates a single module's <name>.cc from its api.js, via
// lib/gen.js's bindings() (same mechanism `lo gen <file>` uses -
// driven by an env var here rather than argv, since the prebuilt
// /root/lo binary's CLI-subcommand dispatch is unreliable - see
// LO-BINDINGS.md). Run via /root/lo (needs the `lo` global; plain node
// can't import api.js files that reference it, e.g. curl/api.js's
// lo.core.os / python/api.js's lo.getenv checks).
//
// Usage: GEN_MODULE=<name> /root/lo bindings/gen-module.js > lib/<name>/<name>.cc
const mod = lo.getenv('GEN_MODULE')
if (!mod) {
  console.error('usage: GEN_MODULE=<name> /root/lo bindings/gen-module.js')
  lo.exit(1)
}
const { bindings } = await import('lib/gen.js')
const api = await import(`lib/${mod}/api.js`)
console.log(bindings(api))
