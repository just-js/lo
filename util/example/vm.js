import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { system } from 'lib/system.js'
import { stats } from 'lib/stats.js'

const { createIsolateContext, contextSize } = spin.load('spin').spin
const { thread } = spin.load('thread')

const { fs, dlsym, addr, cstr, colors } = spin
const { readFile, write, read } = fs
const { AY, AG, AR, AD, AC, AM } = colors

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

function spawnJS (main = '', js = '', args = []) {
  const cleanup = 1
  const onexit = 0
  const startupData = 0
  const ctx = new Uint8Array(contextSize())
  const fd = system.eventfd(0, 0)
  //this needs to be allocated off the v8 heap so we can control when it is freed. how?? 
  const buf = new Uint8Array(new SharedArrayBuffer(4 * 1024)) // should be a sharedarraybuffer?
  createIsolateContext(args.length, makeArgs(args), main, main.length, js, 
    js.length, buf, buf.length, fd, 0, 'spin', 'foo.js', cleanup, onexit, 
    startupData, ctx)
  const tbuf = new Uint32Array(2)
  const rcbuf = new Uint32Array(2)
  fs.fcntl(fd, O_NONBLOCK, 0)
  const tb = new BigUint64Array(1)
  const tidb = new Uint8Array(tb.buffer)
  eventLoop.add(fd, () => {
    read(fd, tidb, 8)
    const tid = Number(tb[0])
    const t = threads[tid]
    t.stats.recv++
    t.stats.clock = currentTime
  }, Loop.Readable | Loop.EdgeTriggered)
  spin.assert(thread.create(tbuf, 0, start_isolate_address, ctx) === 0, 'could not create thread')
  const tid = addr(tbuf)
  const stats = {
    recv: 0,
    clock: currentTime
  }
  threads[tid] = { tid, ctx, fd, buf, stats }
  const rc = thread.tryJoin(tid, rcbuf)
  spin.assert(rc === 0 || rc === EBUSY)
  return { tid, rc, ctx, fd, buf, stats }
}

const start_isolate_address = dlsym(0, 'spin_start_isolate')
spin.assert(start_isolate_address, `could not locate symbol`)
const decoder = new TextDecoder()
const main = decoder.decode(readFile('./util/example/thread/threadMain.js'))
const js = decoder.decode(readFile('./runner.js'))
const args = ['spin', 'foobar.js']
const eventLoop = new Loop()
const O_NONBLOCK = 2048
const id = system.getpid()

let currentTime = spin.hrtime()

const clock = new Timer(eventLoop, 100, () => {
  currentTime = spin.hrtime()
})

function pad (v, c = 3) {
  if (v < 10) return (Math.floor(v * 100) / 100).toFixed(2).padStart(c, ' ')
  return Math.floor(v).toString().padStart(c, ' ')
}

const timer = new Timer(eventLoop, 1000, () => {
  const [utime, stime, , , ticks] = system.cputime()
  const tick = ((ticks - lastTicks))
  const usr = ((utime - lastUsr) / tick) * 100
  const sys = ((stime - lastSys) / tick) * 100
  lastUsr = utime
  lastSys = stime
  lastTicks = ticks
  const total = usr + sys
  const rss = Math.floor(system.getrusage()[0] / 1000)
/*
  const times = tids.map(tid => (Math.abs(1000000000 - (currentTime - threads[tid].stats.clock))) / 1000000)
  console.log(times)
  console.log(stats.percentile(times, 50))
  console.log(stats.percentile(times, 75))
  console.log(stats.percentile(times, 90))
  console.log(stats.percentile(times, 99))
*/
  const log = [
    `${AG}pid${AD} ${pad(id, 6)} ${AY}rss${AD} ${pad(rss, 4)} ${AC}MB${AD} ${AM}thread${AD} ${pad(tids.length, 6)} ${AG}mem/t${AD} ${pad(rss / tids.length, 6)} ${AC}MB${AD} ${AY}%cpu${AD} ${pad(usr)} ${pad(sys)} ${AG}/${AD} ${pad(total)}`,
    //...tids.map(tid => {
    //  const t = threads[tid]
    //  return `${AM}${t.tid}${AD} ${AG}recv${AD} ${t.stats.recv} ${AY}tdiff${AD} ${(Math.abs(1000000000 - (currentTime - t.stats.clock))) / 1000000} ${AC}ms${AD}`
    //}),
  ]
  console.log(log.join('\n'))
})

let [lastUsr, lastSys, , , lastTicks] = system.cputime()
let tids = []
const threads = {}
const count = parseInt(spin.args[2] || '8', 10)

while (1) {
  if (tids.length < count) {
    args[1] = `thread ${count}`
    const t = spawnJS(main, js, args)
    threads[t.tid] = t
    tids = Object.keys(threads)
  }
  spin.runMicroTasks()
  eventLoop.poll(-1)
}

timer.close()
clock.close()
