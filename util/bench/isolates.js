import { run } from 'lib/bench.js'
import { stats } from 'lib/stats.js'

const { AY, AD } = spin.colors

const { createIsolateContext2, contextSize } = spin.load('spin').spin
const { thread } = spin.load('thread')

const { dlsym, addr, assert, ptr } = spin

const start_isolate_address = dlsym(0, 'spin_start_isolate')

const main = `
spin.hrtime(new Uint32Array(spin.buffer))
`
const js = ''
const ctx = new Uint8Array(contextSize())
const buf = ptr(new Uint8Array(8))

createIsolateContext2(0, 0, main, main.length, js, js.length, buf.ptr, buf.length, 
  0, 0, 'spin', 'bench.js', 1, 0, 0, ctx)

const tbuf = new Uint32Array(2)
const rcbuf = new Uint32Array(2)

const runs = 1000
const iter = 100
let done = 0
const times = new Uint32Array(runs)

function spawnIsolate (ctx) {
  const start = spin.hrtime()
  assert(thread.create(tbuf, 0, start_isolate_address, ctx) === 0)
  thread.join(addr(tbuf), rcbuf)
  const time = Number((new BigUint64Array(buf.buffer))[0])
  assert(addr(rcbuf) === 0)
  const elapsed = time - start
  times[done] = elapsed
  done++
}

function showStats () {
  const logs = []
  logs.push(`${AY}P50${AD}        ${stats.percentile(Array.from(times), 50)}`)
  logs.push(`${AY}P75${AD}        ${stats.percentile(Array.from(times), 75)}`)
  logs.push(`${AY}P90${AD}        ${stats.percentile(Array.from(times), 90)}`)
  logs.push(`${AY}P95${AD}        ${stats.percentile(Array.from(times), 95)}`)
  logs.push(`${AY}P99${AD}        ${stats.percentile(Array.from(times), 99)}`)
  logs.push(`${AY}P100${AD}       ${stats.percentile(Array.from(times), 100)}`)
  console.log(logs.join(' '))
  done = 0
}

run('spawnIsolate', () => spawnIsolate(ctx), runs, iter, showStats)
