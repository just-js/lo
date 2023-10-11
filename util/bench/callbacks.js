import { mem } from 'lib/bench.js'
const { callbacks } = spin.load('callbacks')

/*
make MODULE=callbacks library
*/

function fn (counter) {
  return counter + 1
}

const runs = 40000000

while (1) {
  const start = spin.hrtime()
  callbacks.call_callback(fn, runs)
  const elapsed = (spin.hrtime() - start)
  const rate = Math.floor(runs / (elapsed / 1e9))
  const ns_iter = Math.floor(elapsed / runs)
  console.log(`time ${elapsed.toFixed(2)} rss ${mem()} rate ${rate} ns/iter ${ns_iter}`)
}
