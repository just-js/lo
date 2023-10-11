const AD = '\u001b[0m' // ANSI Default
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow

const colors = { AD, AG, AY }

function pad (v, size, precision = 0) {
  return v.toFixed(precision).padStart(size, ' ')
}

function findmem (str) {
  const space = ' '
  let spaces = 0
  let last = 0
  while (spaces < 24) {
    const i = str.indexOf(space, last)
    if (i > 0) {
      if (spaces++ === 23) return (Number(str.slice(last, i)) * 4096) / 1024
      last = i + 1
    } else {
      break
    }
  }
}

async function wrap_mem_usage () {
  if (globalThis.Deno) {
    return () => Math.floor((Number((new TextDecoder()).decode(Deno.readFileSync('/proc/self/stat')).split(' ')[23]) * 4096)  / (1024))
  }
  if (globalThis.Bun) {
    const fs = require('node:fs')
    return () => Math.floor((Number((new TextDecoder()).decode(fs.readFileSync('/proc/self/stat')).split(' ')[23]) * 4096)  / (1024))
  } else if (globalThis.process) {
    const fs = await import('fs')
    return () => Math.floor((Number((new TextDecoder()).decode(fs.readFileSync('/proc/self/stat')).split(' ')[23]) * 4096)  / (1024))
  }
  if (globalThis.spin) {
    const { pread, open } = spin.fs
    const O_RDONLY = 0
    const fd = open(`/proc/self/stat`, O_RDONLY)
    const buf = spin.ptr(new Uint8Array(1024))
    function readUsage () {
      if (pread(fd, buf, 1024, 0) > 0) return findmem(decoder.decode(buf))
      return 0
    }
    return readUsage
  }
  if (globalThis.just) {
    return () => Math.floor(Number(just.memoryUsage().rss)  / 1024)
  }
}

function formatNanos (nanos) {
  if (nanos >= 1000000000) return `${AY}sec/iter${AD} ${pad((nanos / 1000000000), 10, 2)}`
  if (nanos >= 1000000) return `${AY}ms/iter${AD} ${pad((nanos / 1000000), 10, 2)}`
  if (nanos >= 1000) return `${AY}μs/iter${AD} ${pad((nanos / 1000), 10, 2)}`
  return `${AY}ns/iter${AD} ${pad(nanos, 10, 2)}`
}

function bench (name, fn, count, after = noop) {
  const start = performance.now()
  for (let i = 0; i < count; i++) fn()
  const elapsed = (performance.now() - start)
  const rate = Math.floor(count / (elapsed / 1000))
  const nanos = 1000000000 / rate
  const rss = mem()
  console.log(`${name.slice(0, 32).padEnd(17, ' ')} ${pad(Math.floor(elapsed), 6)} ms ${AG}rate${AD} ${pad(rate, 10)} ${formatNanos(nanos)} ${AG}rss${AD} ${rss}`)
  after()
  return { name, count, elapsed, rate, nanos, rss, runtime }
}

async function benchAsync (name, fn, count, after = noop) {
  const start = performance.now()
  for (let i = 0; i < count; i++) await fn()
  const elapsed = (performance.now() - start)
  const rate = Math.floor(count / (elapsed / 1000))
  const nanos = 1000000000 / rate
  const rss = mem()
  console.log(`${name.slice(0, 32).padEnd(17, ' ')} ${pad(Math.floor(elapsed), 6)} ms ${AG}rate${AD} ${pad(rate, 10)} ${formatNanos(nanos)} ${AG}rss${AD} ${rss}`)
  after()
  return { name, count, elapsed, rate, nanos, rss, runtime }
}

const runAsync = async (name, fn, count, repeat = 10, after = () => {}) => {
  const runs = []
  for (let i = 0; i < repeat; i++) {
    runs.push(await benchAsync(name, fn, count, after))
  }
  return runs
}

const run = (name, fn, count, repeat = 10, after = () => {}) => {
  const runs = []
  for (let i = 0; i < repeat; i++) {
    runs.push(bench(name, fn, count, after))
  }
  return runs
}

function arrayEquals (a, b) {
  return Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index])
}

class Bench {
  #start = 0
  #end = 0
  #name = 'bench'
  #display = true

  constructor (display = true) {
    this.#display = display
  }

  start (name = 'bench') {
    this.#name = name.slice(0, 32).padEnd(32, ' ')
    this.#start = performance.now()
  }

  end (count = 0) {
    this.#end = performance.now()
    const elapsed = this.#end - this.#start
    const rate = Math.floor(count / (elapsed / 1000))
    const nanos = 1000000000 / rate
    const rss = mem()
    if (this.#display) console.log(`${this.#name} ${pad(Math.floor(elapsed), 6)} ms ${AG}rate${AD} ${pad(rate, 10)} ${formatNanos(nanos)} ${AG}rss${AD} ${rss}`)
    return { name: this.#name.trim(), count, elapsed, rate, nanos, rss, runtime }
  }
}

const runtime = { name: '', version: '' }

if (globalThis.spin) {
  globalThis.performance = { now: () => spin.hrtime() / 1000000 }
  globalThis.assert = spin.assert
}
if (globalThis.Deno) {
  globalThis.args = Deno.args
  runtime.name = 'deno'
  runtime.version = Deno.version.deno
  runtime.v8 = Deno.version.v8
  globalThis.readFileAsText = async fn => decoder.decode(Deno.readFileSync(fn))
} else if (globalThis.spin) {
  globalThis.args = spin.args.slice(2)
  runtime.name = 'spin'
  runtime.version = spin.version.spin
  runtime.v8 = spin.version.v8
  globalThis.readFileAsText = async fn => decoder.decode(spin.fs.readFile(fn))
} else if (globalThis.Bun) {
  globalThis.args = Bun.argv.slice(2)
  runtime.name = 'bun'
  runtime.version = Bun.version
  globalThis.readFileAsText = async fn => (await Bun.file(fn).text())
} else if (globalThis.process) {
  globalThis.args = process.argv.slice(2)
  runtime.name = 'node'
  runtime.version = process.version
  runtime.v8 = process.versions.v8
  const fs = await import('fs')
  globalThis.readFileAsText = async fn => decoder.decode(fs.readFileSync(fn))
} else if (globalThis.just) {
  globalThis.performance = { now: () => just.hrtime() / 1000000 }
  globalThis.args = just.args.slice(2)
  runtime.name = 'just'
  runtime.version = just.version.just
  runtime.v8 = just.version.v8
  class TextEncoder {
    encode (str) {
      return new Uint8Array(ArrayBuffer.fromString(str))
    }
    encodeInto (str, target) {
      const written = target.buffer.writeString(str, target.byteOffset)
      const read = String.byteLength(str)
      return { read, written }
    }
  }
  globalThis.TextEncoder = TextEncoder

  class TextDecoder {
    constructor (encoding = 'utf-8') {
      this.encoding = encoding
    }
    decode (u8) {
      return u8.buffer.readString(u8.length, u8.byteOffset)
    }
  }
  globalThis.TextDecoder = TextDecoder
  globalThis.console = {
    log: just.print,
    error: just.error
  }
  globalThis.readFileAsText = async fn => just.fs.readFile(fn)
}

globalThis.colors = colors
globalThis.arrayEquals = arrayEquals

const noop = () => {}
const mem = await wrap_mem_usage()
const decoder = new TextDecoder()

if (!globalThis.assert) {
  function assert (condition, message, ErrorType = Error) {
    if (!condition) {
      throw new ErrorType(message || "Assertion failed")
    }
  }

  globalThis.assert = assert
}


export { pad, formatNanos, colors, run, runAsync, Bench, mem, runtime }
