async function loadTestModule () {
  const mod = lo.loadModule(`
  const foo = { hello: "Hello" }

  export { foo }
  `, 'main.js')
  mod.namespace = await lo.evaluateModule(mod.identity)
  mod.evaluated = true
  globalThis.foo = mod
}

async function loadMain () {
  const specifier = 'main.js'
  const src = lo.builtin(specifier)
  const mod = lo.loadModule(src, specifier)
  try {
    mod.namespace = await lo.evaluateModule(mod.identity)
    mod.evaluated = true
  } catch (err) {
    lo.print(`loadMain failed: ${err && err.stack || err}\n`)
  }
  globalThis.mainMod = mod
}

await loadTestModule()
await loadMain()

globalThis.snapshotEntry = async function () {
  try {
    // real dispatch, deferred from main.js's own bootstrap (which
    // skipped it during the build pass, per lo.isBuildingSnapshot) -
    // global_main() re-reads lo.args fresh, which CreateIsolate already
    // set to this real invocation's actual argv before calling here.
    await mainMod.namespace.global_main()
  } catch (err) {
    lo.print(`${err && err.stack || err}\n`)
  }
}
