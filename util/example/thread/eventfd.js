import { system } from 'lib/system.js'

const { createIsolateContext, contextSize } = spin.load('spin').spin
const { thread } = spin.load('thread')
const { dlsym, addr, cstr } = spin
const { write } = spin.fs

function makeArgs (args) {
  if (!args.length) return new Uint32Array(0)
  const b64 = new BigUint64Array(args.length)
  for (let i = 0; i < args.length; i++) {
    const str = argb[i] = cstr(args[i])
    b64[i] = BigInt(str.ptr)
  }
  return new Uint32Array(b64.buffer)
}

const js = `
import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'

const { fs } = spin

const eventLoop = new Loop()

const timer = new Timer(eventLoop, 1000, () => {
  console.log(events)
  events = 0
})

const on = new BigUint64Array([BigInt(1)])
const u8 = new Uint8Array(on.buffer)

let events = 0

const O_NONBLOCK = 2048
fs.fcntl(spin.fd, O_NONBLOCK, 0)

eventLoop.add(spin.fd, () => {
  events++
}, Loop.Readable | Loop.EdgeTriggered)

while (1) {
  spin.runMicroTasks()
  eventLoop.poll(-1)
}

timer.close()
`

const start_isolate_address = dlsym(0, 'spin_start_isolate')
spin.assert(start_isolate_address, `could not locate symbol`)
const argb = []
const args = ['spin']
const decoder = new TextDecoder()
const main = decoder.decode(spin.fs.readFile('./util/example/thread/threadMain.js'))
const buf = new Uint8Array(1)
const fd = system.eventfd(0, 0)
const tbuf = new Uint32Array(2)
const rcbuf = new Uint32Array(2)
const ctx = new Uint8Array(contextSize())
createIsolateContext(args.length, makeArgs(args), main, main.length, js, js.length,
  buf, buf.length, fd, 0, 'spin', 'thread.js', 0, 0, 0, ctx)

let rc = thread.create(tbuf, 0, start_isolate_address, ctx)
spin.assert(rc === 0, 'could not create thread')
const tid = addr(tbuf)

const on = new BigUint64Array([BigInt(1)])
const u8 = new Uint8Array(on.buffer)

rc = thread.tryJoin(tid, rcbuf)

let i = 0
while (i < 10000000) {
  if (write(fd, u8, 8) !== 8) {
    console.log(spin.errno)
    break
  }
  i++
}

thread.cancel(tid)
thread.join(tid, rcbuf)
