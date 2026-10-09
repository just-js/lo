// Module loading: import() and static imports, with top-level await,
// errors, concurrency and caching. Fixtures are in test/modules/ and are
// imported by bare specifier (run from the repo root, like make check):
// relative specifiers are unreliable in lo's loader.
import { plain } from 'test/modules/plain.js'

const { assert } = lo

// import() that must reject; returns the error
async function rejects (specifier) {
  try {
    await import(specifier)
  } catch (err) {
    return err
  }
  assert(false, `import('${specifier}') resolved, expected it to reject`)
}

// lo reports a rejection as soon as a promise rejects with no handler yet
// and exits (main.js on_unhandled_rejection), even if a handler is attached
// moments later: an async function that throws before its first await, or a
// module whose synchronous evaluation throws, is fatal even inside
// try/catch. Run fn with the rejections it reports collected instead.
async function collecting_unhandled (fn) {
  const on_unhandled = globalThis.onUnhandledRejection
  const unhandled = []
  globalThis.onUnhandledRejection = err => unhandled.push(err)
  try {
    return { result: await fn(), unhandled }
  } finally {
    globalThis.onUnhandledRejection = on_unhandled
  }
}

async function test () {
  // a module with top-level await has finished running when import()
  // resolves: its exports are initialized and its side effects are done
  const tla = await import('test/modules/tla.js')
  assert(tla.ready === 'ready')
  assert(globalThis.lo_test_tla_runs === 1)

  // importing it again gives the same namespace and doesn't rerun it
  assert(await import('test/modules/tla.js') === tla)
  assert(globalThis.lo_test_tla_runs === 1)

  // a synchronous module that statically imports a top-level-await module
  const tla_static = await import('test/modules/tla-static.js')
  assert(tla_static.via_static === 'static ready')
  assert(globalThis.lo_test_tla_runs === 1)

  // concurrent imports of a module share one evaluation
  const [a, b] = await Promise.all([
    import('test/modules/tla-throws.js').catch(err => err),
    import('test/modules/tla-throws.js').catch(err => err)
  ])
  assert(a instanceof Error && a.message === 'tla-throws')
  assert(b === a)

  // an error after top-level await rejects import(), again on a re-import
  assert(await rejects('test/modules/tla-throws.js') === a)

  // a statically imported module, imported again dynamically: the same
  // instance, not a second copy
  const p = await import('test/modules/plain.js')
  assert(p.plain === plain)
  assert(globalThis.lo_test_plain_runs === 1)

  // an error during synchronous evaluation rejects import(), and a
  // re-import rejects with the same error without rerunning the module
  const { result: err, unhandled } = await collecting_unhandled(() => rejects('test/modules/throws.js'))
  assert(err instanceof Error && err.message === 'throws')
  assert(unhandled.length === 1 && unhandled[0] === err)
  assert(await rejects('test/modules/throws.js') === err)
  assert(globalThis.lo_test_throws_runs === 1)

  // a module that imports itself while still evaluating gets its own
  // namespace once it has finished
  const self = await import('test/modules/self.js')
  assert(await self.self === self)
  assert(self.name === 'self')

  // a missing module rejects, and a later import of it fails again
  // (failed loads aren't cached)
  for (let i = 0; i < 2; i++) {
    const missing = await collecting_unhandled(() => rejects('test/modules/does-not-exist.js'))
    assert(missing.result instanceof Error && missing.result.message.includes('does-not-exist.js'))
  }
}

export { test }
