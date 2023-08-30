import { system } from 'lib/system.js'

const { dlsym, addr, cstr, assert, nextTick, load, fs, hrtime } = spin
const { createIsolateContext, contextSize } = load('spin').spin
const { thread } = load('thread')
const { write, readFile } = fs

const EBUSY = 16

function makeArgs (args) {
  const argb = new Array(args.length)
  if (!args.length) return new Uint32Array(0)
  const b64 = new BigUint64Array(args.length)
  for (let i = 0; i < args.length; i++) {
    const str = argb[i] = cstr(args[i])
    b64[i] = BigInt(str.ptr)
  }
  return new Uint32Array(b64.buffer)
}

function createThread () {
  const ctx = new Uint8Array(contextSize())
  const tbuf = new Uint32Array(2)
  const buf = new Uint8Array(1)
  createIsolateContext(args.length, makeArgs(args), main, main.length, js, js.length,
    buf, buf.length, fd, hrtime(), 'spin', 'thread.js', 0, 0, 0, ctx)
  let rc = thread.create(tbuf, 0, start_isolate_address, ctx)
  assert(rc === 0, 'could not create thread')
  const tid = addr(tbuf)
  threads[tid] = { tid, ctx, tbuf, buf }
}

const js = `
console.log(spin.hrtime() - spin.start)
import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
const { thread } = spin.load('thread')

const { fs } = spin

const tid = thread.self()

const eventLoop = new Loop()

const timer = new Timer(eventLoop, 1000, () => {
  console.log('thread ' + tid + ' events ' + events)
})

const on = new BigUint64Array([BigInt(1)])
const u8 = new Uint8Array(on.buffer)

let events = 0
const O_NONBLOCK = 2048
fs.fcntl(spin.fd, O_NONBLOCK, 0)

eventLoop.add(spin.fd, () => {
  events++
}, Loop.Readable | Loop.EdgeTriggered)

while (events < 2000000) {
  spin.runMicroTasks()
  eventLoop.poll(-1)
}

timer.close()
`

const args = ['spin']
const decoder = new TextDecoder()
const main = decoder.decode(readFile('./util/example/thread/threadMain.js'))
const O_NONBLOCK = 2048
const fd = system.eventfd(0, O_NONBLOCK)
const rcbuf = new Uint32Array(2)
const signal = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0])
const threads = {}
const start_isolate_address = dlsym(0, 'spin_start_isolate')
assert(start_isolate_address, `could not locate symbol`)

const THREADS = 10

for (let i = 0; i < THREADS; i++) createThread()

function poll() {
  for (const tid of Object.keys(threads)) {
    const t = threads[tid]
    const rc = thread.tryJoin(t.tid, rcbuf)
    if (rc === 0) {
      console.log(`thread ${t.tid} complete`)
      //createThread()
      delete threads[t.tid]
    } else if (rc !== EBUSY) {
      console.log(`thread error ${rc}`)
      return
    }
  }
  const written = write(fd, signal, 8)
  if (written === -1) {
    console.log(system.strerror(spin.errno))
    return
  }
  if (Object.keys(threads).length === 0) {
    shutdown()
    return
  }
  nextTick(poll)
}

function shutdown () {
  console.log('shutting down')
}

poll()
