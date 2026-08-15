// Regenerates a single module's <name>.cc from its api.js, via
// lib/gen.js's bindings() (same mechanism `lo gen <file>` uses - driven
// by an env var here rather than argv, since the prebuilt /root/lo
// binary's CLI-subcommand dispatch is unreliable - see LO-BINDINGS.md).
//
// Runs under either `node` or `lo` - both resolve bare `lib/*.js`
// specifiers against the process's CWD (lo natively; node via
// gen-loader.js, registered below), so run from repos/lo's root either
// way:
//
//   GEN_MODULE=<name> node bindings/gen-module.js > lib/<name>/<name>.cc
//   GEN_MODULE=<name> /root/lo bindings/gen-module.js > lib/<name>/<name>.cc
const isNode = !!globalThis.process?.versions?.node
if (isNode) {
  const { register } = await import('node:module')
  register('./gen-loader.js', import.meta.url)
}

const mod = isNode ? process.env.GEN_MODULE : lo.getenv('GEN_MODULE')
if (!mod) {
  console.error('usage: GEN_MODULE=<name> node|lo bindings/gen-module.js')
  isNode ? process.exit(1) : lo.exit(1)
}
const { bindings } = await import('lib/gen.js')
const api = await import(`lib/${mod}/api.js`)
console.log(bindings(api))
