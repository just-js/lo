
const AD = '\u001b[0m' // ANSI Default
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow

const colors = { AD, AG, AY }

function pad (v, size, precision = 0) {
  return v.toFixed(precision).padStart(size, ' ')
}

function formatNanos (nanos) {
  if (nanos >= 1000000000) return `${AY}sec/iter${AD} ${pad((nanos / 1000000000), 10, 2)}`
  if (nanos >= 1000000) return `${AY}ms/iter${AD} ${pad((nanos / 1000000), 10, 2)}`
  if (nanos >= 1000) return `${AY}μs/iter${AD} ${pad((nanos / 1000), 10, 2)}`
  return `${AY}ns/iter${AD} ${pad(nanos, 10, 2)}`
}

function bench (name, fn, count) {
  const start = performance.now()
  for (let i = 0; i < count; i++) fn()
  const elapsed = (performance.now() - start)
  const rate = Math.floor(count / (elapsed / 1000))
  const nanos = Math.floor(1000000000 / rate)
  console.log(`${name.slice(0, 16).padEnd(17, ' ')} ${pad(Math.floor(elapsed), 6)} ms ${AG}rate${AD} ${pad(rate, 10)} ${formatNanos(nanos)}`)
  return { name, count, elapsed, rate, nanos }
}

if (globalThis.spin) {
  globalThis.performance = { now: () => spin.hrtime() / 1000000 }
  globalThis.assert = spin.assert
  const { utf8Encode } = spin
  class TextEncoder {
    encode (str) {
      return utf8Encode(str)
    }
  }
  globalThis.TextEncoder = TextEncoder
} else {
  function assert (condition, message, ErrorType = Error) {
    if (!condition) {
      throw new ErrorType(message || "Assertion failed")
    }
  }
  globalThis.assert = assert
}

if (globalThis.Deno) {
  globalThis.args = Deno.args
} else if (globalThis.process) {
  globalThis.args = process.argv.slice(2)
} else if (globalThis.spin) {
  globalThis.args = spin.args.slice(2)
}

globalThis.colors = colors

const run = (name, fn, count, repeat = 10) => {
  const runs = []
  for (let i = 0; i < repeat; i++) {
    runs.push(bench(name, fn, count))
  }
  return runs
}

export { pad, formatNanos, colors, run }
