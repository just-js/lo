import { mem, cputime } from 'lib/proc.js'

const { AY, AD, AG, AM } = lo.colors

const noop = () => {}

function pad (v, size, precision = 0) {
  return v.toFixed(precision).padStart(size, ' ')
}

function formatNanos (nanos) {
  if (nanos >= 1000000000) return `${AY}sec/iter${AD} ${pad((nanos / 1000000000), 10, 2)}`
  if (nanos >= 1000000) return `${AY}ms/iter${AD} ${pad((nanos / 1000000), 10, 2)}`
  if (nanos >= 1000) return `${AY}μs/iter${AD} ${pad((nanos / 1000), 10, 2)}`
  return `${AY}ns/iter${AD} ${pad(nanos, 10, 2)}`
}

class Bench {
  #start = 0
  #end = 0
  #name = 'bench'
  #display = true

  constructor (display = true) {
    this.#display = display
  }

  start (name = 'bench', pad = 32) {
    this.#name = name.slice(0, pad).padEnd(pad, ' ')
    this.#start = lo.hrtime()
  }

  end (count = 0) {
    this.#end = lo.hrtime()
    const elapsed = this.#end - this.#start
    const rate = Math.floor(count / (elapsed / 1e9))
    const nanos = 1000000000 / rate
    const rss = mem()
    let [ usr, , sys ] = cputime()
    const cpu_time = elapsed / 10
    usr = Math.floor((usr / cpu_time) * 100)
    sys = Math.floor((sys / cpu_time) * 100)
    if (this.#display) console.log(`${AM}${this.#name.trim()}${AD} ${AY}time${AD} ${Math.floor(elapsed)} ${AY}rate${AD} ${rate} ${AG}ns/iter${AD} ${formatNanos(nanos)} ${AG}rss${AD} ${rss} ${AY}usr${AD} ${usr.toString().padStart(3, ' ')} ${AY}sys${AD}  ${sys.toString().padStart(3, ' ')} ${AY}tot${AD} ${(usr + sys).toString().padStart(3, ' ')}`)
//    if (this.#display) console.log(`${this.#name} ${AG}rate${AD} ${pad(rate, 10)} ${formatNanos(nanos)} ${AM}rss${AD} ${rss}`)
    return { name: this.#name.trim(), count, elapsed, rate, nanos, rss }
  }
}

function bench (name, fn, count, after = noop) {
  const bench = new Bench()
  bench.start(name)
  for (let i = 0; i < count; i++) fn()
  const result = bench.end(count)
  after()
  return result
}

export { Bench, bench }
