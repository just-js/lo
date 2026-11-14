// minimal startup-snapshot test: the top level runs once, at build time, and
// its heap is frozen into the binary; snapshotEntry runs on every start
// (V8-SNAPSHOT.md: no typed-array addresses or native calls before
// snapshotEntry)
const items = []
for (let i = 0; i < 100000; i++) items.push({ i, name: `item ${i}` })
globalThis.state = { items, built_with_snapshot: true }

function sum () {
  let total = 0
  for (const item of state.items) total += item.i
  return total
}

globalThis.snapshotEntry = function () {
  lo.print(`snapshotEntry: ${state.items.length} items, sum ${sum()}, last "${state.items[state.items.length - 1].name}"\n`)
}
