import { Worker } from 'lib/worker.js'
import { spawn, join } from 'lib/thread.js'

const { getpid } = lo.core

function pid () {
  return getpid()
}

function opt (fn) {
  %PrepareFunctionForOptimization(fn);
  %OptimizeFunctionOnNextCall(fn);
}

let start = lo.hrtime()
const api = {}
const names = Object.getOwnPropertyNames(lo.core)
for (const name of names) {
  api[name] = (...args) => lo.core[name](...args)
  opt(api[name])
}
console.log(lo.hrtime() - start)

// force spawn/join straight to TURBOFAN with zero prior invocations - see lib/thread.js
// for the hoisting that makes this safe (no property access left needing IC feedback)
opt(spawn)
opt(join)

const worker = new Worker('', [], ';')
worker.create()

start = Date.now()
const runs = 1000

for (let i = 0; i < runs; i++) {
  worker.start().waitfor()
}

const elapsed = Date.now() - start
const rate = runs / (elapsed / 1000)
console.log(rate)

worker.free()