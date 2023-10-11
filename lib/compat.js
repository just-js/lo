const runtime = { name: '', version: '' }

const decoder = new TextDecoder()

const AD = '\u001b[0m' // ANSI Default
const A0 = '\u001b[30m' // ANSI Black
const AR = '\u001b[31m' // ANSI Red
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow
const AB = '\u001b[34m' // ANSI Blue
const AM = '\u001b[35m' // ANSI Magenta
const AC = '\u001b[36m' // ANSI Cyan
const AW = '\u001b[37m' // ANSI White

const colors = { AD, A0, AR, AG, AY, AB, AM, AC, AW }

function assert (condition, message, ErrorType = Error) {
  if (!condition) {
    throw new ErrorType(message || "Assertion failed")
  }
}

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
    this.#start = performance.now()
  }

  end (count = 0) {
    this.#end = performance.now()
    const elapsed = this.#end - this.#start
    const rate = Math.floor(count / (elapsed / 1000))
    const nanos = 1000000000 / rate
    const rss = runtime.mem()
    const [usr, sys, tick] = runtime.cputime()
    if (this.#display) console.log(`${this.#name} ${pad(Math.floor(elapsed), 6)} ms ${AG}rate${AD} ${pad(rate, 10)} ${formatNanos(nanos)} ${AG}rss${AD} ${rss} ${AY}cpu${AD} ${pad(usr, 4)} / ${pad(sys, 4)} ${pad(tick, 4)}`)
    return { name: this.#name.trim(), count, elapsed, rate, nanos, rss, runtime }
  }
}

function to_size_string (bytes) {
  bytes *= 8
  if (bytes < 1000) {
    return `${pad(bytes, 6)} b`
  } else if (bytes < 1000 * 1000) {
    return `${pad(Math.floor((bytes / 1000) * 100) / 100, 6)} k`
  } else if (bytes < 1000 * 1000 * 1000) {
    return `${pad(Math.floor((bytes / (1000 * 1000)) * 100) / 100, 6)} m`
  }
  return `${pad(Math.floor((bytes / (1000 * 1000 * 1000)) * 100) / 100, 6)} g`
}

const cpu32 = new Uint32Array(9)
const cpu = [0, 0, 0]
runtime.cputime = () => cpu
runtime.pad = pad
runtime.to_size_string = to_size_string
runtime.formatNanos = formatNanos
runtime.assert = assert
runtime.runtime = runtime
runtime.colors = colors
runtime.Bench = Bench
globalThis.runtime = runtime

if (globalThis.spin) {

  const { wrapMemory, hrtime, start, version, args, wrap, load } = spin
  const { system } = load('system')
  const { fs, isFile, getStat } = await import('lib/fs.js')
  const { open, fstat, read, close } = fs

  const O_RDONLY = 0
  const O_CLOEXEC = 524288
  const O_NOATIME = 262144
  const stat = new Uint8Array(160)
  const stat32 = new Uint32Array(stat.buffer)
  const read_only_flags = O_RDONLY | O_CLOEXEC | O_NOATIME

  class Performance {
    static now () {
      return (hrtime() - start) / 1000000
    }
  }

  function readFile (path) {
    let off = 0
    let len = 0
    const fd = open(path, read_only_flags)
    assert(fd > 0)
    fstat(fd, stat)
    const size = stat32[12] || 64 * 1024
    const dest = calloc(1, size)
    const u8 = new Uint8Array(wrapMemory(dest, size, 1))
    while ((len = read(fd, u8.subarray(off), size - off)) > 0) off += len
    assert(close(fd) === 0)
    return u8
  }

  function cputime () {
    const ticks = system.times(cpubuf)
    const [utime, , stime] = cpu32
    cpu[0] = utime - lastUsr
    cpu[1] = stime - lastSys
    cpu[2] = ticks - lastTicks
    lastUsr = utime
    lastSys = stime
    lastTicks = ticks
    return cpu
  }

  const calloc = wrap(new Uint32Array(2), system.calloc, 2)
  runtime.name = 'spin'
  runtime.version = version.spin
  runtime.v8 = version.v8
  runtime.readFile = readFile
  runtime.readFileAsText = async fn => decoder.decode(readFile(fn))
  runtime.args = args.slice(2)
  runtime.mem = () => Math.floor((Number(decoder.decode(readFile('/proc/self/stat')).split(' ')[23]) * 4096)  / (1024))
  const cpubuf = new Uint8Array(cpu32.buffer)
  cpu32[4] = system.times(cpubuf)
  let [lastUsr, lastSys, , , lastTicks] = cpu32
  runtime.cputime = cputime

  WebAssembly.instantiateStreaming = (buf, imports) => {
    return new Promise ((ok, fail) => {
      try {
        const mod = new WebAssembly.Module(buf)
        const instance = new WebAssembly.Instance(mod, imports)
        ok({ instance })
      } catch (err) {
        fail(err)
      }
    })
  }

  class XMLHttpRequest {
    constructor () {
      this.responseType = 'arraybuffer'
      this.status = 0
      this.response = null
      this.headers = {}
      this.files = {}
    }

    open (method, path) {
      this.method = method
      this.path = path
    }
    
    send () {
      const { method, path } = this
      if (method === 'HEAD') {
        if (isFile(path)) {
          this.status = 200
          this.response = null
          this.headers['content-length'] = getStat(path).size
          return
        }
        this.status = 404
        return
      }
      if (method === 'GET') {
        const range = this.headers.Range || this.headers.range
        const [ start, end ] = range.split('=')[1].split('-').map(s => parseInt(s, 10))
        if (!this.files[path]) {
          this.files[path] = readFile(path)
        }
        this.status = 206
        const buf = this.files[path].slice(start, end + 1)
        this.headers['content-length'] = buf.byteLength
        this.response = buf
        return
      }
    }

    getResponseHeader (name) {
      return this.headers[name.toLowerCase()]
    }

    setRequestHeader (name, value) {
      this.headers[name.toLowerCase()] = value
    }
  }
  globalThis.fetch = (path) => {
    return Promise.resolve(readFile(path).buffer)
  }
  globalThis.XMLHttpRequest = XMLHttpRequest
  globalThis.performance = Performance
  globalThis.filePath = f => f
} else if (globalThis.Bun) {
  runtime.name = 'bun'
  runtime.version = Bun.version
  // this is very slow
  //runtime.readFileAsync = async fn => new Uint8Array(await (Bun.file(fn).arrayBuffer()))
  //runtime.readFileAsTextAsync = fn => Bun.file(fn).text()
  const fs = require('fs')
  runtime.readFile = fn => new Uint8Array(fs.readFileSync(fn))
  runtime.readFileAsText = async fn => decoder.decode(fs.readFileSync(fn))
  runtime.args = process.argv.slice(2)
  runtime.mem = () => Math.floor((Number(decoder.decode(fs.readFileSync('/proc/self/stat')).split(' ')[23]) * 4096)  / (1024))
} else if (globalThis.Deno) {
  const { readFileSync, version, args } = Deno
  const { ops } = Deno[Deno.internal].core
  runtime.name = 'deno'
  runtime.version = version.deno
  runtime.v8 = version.v8
  runtime.readFile = fn => readFileSync(fn)
  runtime.readFileAsText = async fn => decoder.decode(readFileSync(fn))
  runtime.args = args.slice(0)
  runtime.mem = () => Math.floor((Number(decoder.decode(readFileSync('/proc/self/stat')).split(' ')[23]) * 4096)  / (1024))
  const now_buf = new Uint8Array(8)
  const hr = new Uint32Array(now_buf.buffer)
  function opNow() {
    ops.op_now(now_buf);
    return (hr[0] * 1000 + hr[1] / 1e6);
  }
  performance.now = opNow
} else if (globalThis.process) {
  const fs = require('fs')
  const { readFileSync } = fs
  runtime.name = 'node'
  runtime.version = process.version
  runtime.v8 = process.versions.v8
  runtime.readFile = fn => new Uint8Array(readFileSync(fn))
  runtime.readFileAsText = async fn => decoder.decode(readFileSync(fn))
  runtime.args = process.argv.slice(2)
  runtime.mem = () => Math.floor((Number(decoder.decode(readFileSync('/proc/self/stat')).split(' ')[23]) * 4096)  / (1024))
}
