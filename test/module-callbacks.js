// The module callbacks (lo.setModuleCallbacks) and lo.evaluateModule when
// things go wrong: every failure is a catchable JS error, never a crash, an
// empty module or a printed message. Most cases install their own callbacks
// around in-memory modules (lo.loadModule(source, name)) and put main.js's
// back afterwards. Run from the repo root, like make check.
const { assert, loadModule, evaluateModule, setModuleCallbacks } = lo

function restore () {
  setModuleCallbacks(lo.on_module_load, lo.on_module_instantiate)
}

// run fn with our own callbacks, always putting main.js's back
async function with_callbacks (on_load, on_instantiate, fn) {
  setModuleCallbacks(on_load, on_instantiate)
  try {
    return await fn()
  } finally {
    restore()
  }
}

// fn() must throw (or reject) with a message matching rx; returns the error
async function throws (fn, rx) {
  try {
    await fn()
  } catch (err) {
    assert(rx.test(err.message), `expected ${rx}, got ${err.constructor.name}: ${err.message}`)
    return err
  }
  assert(false, `expected a throw matching ${rx}`)
}

// a fresh exporter/importer pair each time: an instantiated module keeps its
// first result
let pairs = 0
function pair (importer = name => `import { b } from '${name}'; export const a = b + 1`) {
  pairs++
  const b = loadModule('export const b = 1', `callbacks-b-${pairs}.js`)
  const a = loadModule(importer(`callbacks-b-${pairs}.js`), `callbacks-a-${pairs}.js`)
  return { a, b }
}

// as main.js does: a rejection with no handler yet is fatal unless collected
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
  // the instantiate callback returns nothing: an error naming the import (a
  // runtime without main.js that forgot to return an identity used to get an
  // empty module and a printed "Can't instantiate module.")
  {
    const { a } = pair()
    await with_callbacks(lo.on_module_load, () => undefined, () =>
      throws(() => evaluateModule(a.identity), /cannot import "callbacks-b-\d+\.js": the module instantiate callback did not return/))
  }

  // the instantiate callback throws: its own error reaches the caller (it
  // used to abort the process in ToLocalChecked, PLAN.md task 79)
  {
    const { a } = pair()
    await with_callbacks(lo.on_module_load, () => { throw new Error('resolver failed') }, () =>
      throws(() => evaluateModule(a.identity), /^resolver failed$/))
  }

  // the callback gets the importing module's identity as its second argument,
  // and a good answer instantiates and evaluates the module
  {
    const { a, b } = pair()
    const seen = []
    const ns = await with_callbacks(lo.on_module_load, (specifier, referrer) => {
      seen.push({ specifier, referrer })
      return b.identity
    }, () => evaluateModule(a.identity))
    assert(seen.length === 1 && seen[0].specifier === b.specifier && seen[0].referrer === a.identity)
    assert(ns.a === 2)
  }

  // V8's own instantiation error (a missing export) is rethrown
  {
    const { a, b } = pair(name => `import { nope } from '${name}'; export const a = nope`)
    await with_callbacks(lo.on_module_load, () => b.identity, () =>
      throws(() => evaluateModule(a.identity), /nope/))
  }

  // evaluateModule with something that isn't a loaded module's identity
  await throws(() => evaluateModule(undefined), /expected a module identity/)
  await throws(() => evaluateModule(123456789), /no loaded module has this identity/)

  // import() with a loader callback that throws rejects with its error. The
  // promise is rejected before the caller can attach a handler, which lo
  // reports as unhandled (as test/import.js shows for V8's own rejections)
  const loader = await collecting_unhandled(() =>
    with_callbacks(() => { throw new Error('loader failed') }, lo.on_module_instantiate, () =>
      throws(() => import('callbacks-anything.js'), /^loader failed$/)))
  assert(loader.unhandled.length === 1 && loader.unhandled[0] === loader.result)

  // import() with a loader callback that returns a value, not a promise,
  // resolves to that value
  const value = await with_callbacks(() => ({ x: 1 }), lo.on_module_instantiate, () =>
    import('callbacks-anything-else.js'))
  assert(value.x === 1)

  // PLAN.md task 79's chain: entry.js statically imports a/mid.js (bare), which imports
  // '../lib.js' through the instantiate callback. main.js resolves relative specifiers against the cwd today,
  // so the import fails, but with an error instead of a segfault; once
  // relative imports resolve against the importer it must load correctly.
  const { result } = await collecting_unhandled(async () => {
    try {
      return await import('test/modules/relative/entry.js')
    } catch (err) {
      return err
    }
  })
  if (result instanceof Error) {
    assert(result.message.includes('lib.js'), `unexpected error: ${result.message}`)
  } else {
    assert(result.doubled === 84)
  }

  // main.js's loader still works after all of that
  const { join } = await import('lib/path.js')
  assert(typeof join === 'function')
}

export { test }
