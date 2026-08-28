// Same measurement as runtime/zero.js, but split into a definitions-only
// prefix (safe to freeze into a V8 startup snapshot) and an explicit
// per-invocation entry point (globalThis.snapshotEntry), which
// lo::CreateIsolate calls directly when loading from a snapshot instead
// of re-parsing/re-executing this file. See PLAN.md task 64.

function addr (u32) {
  return u32[0] + ((2 ** 32) * u32[1])
}

function get_address (buf) {
  lo.getAddress(buf, handle)
  return addr(handle)
}

function hrtime () {
  lo.hrtime(handle.ptr)
  return addr(handle)
}

const handle = new Uint32Array(2)

function next_tick (fn) {
  return new Promise(ok => lo.nextTick(ok))
}

globalThis.snapshotEntry = async function () {
  handle.ptr = get_address(handle)
  await next_tick()
  lo.print(`${hrtime() - lo.start}\n`)
}
