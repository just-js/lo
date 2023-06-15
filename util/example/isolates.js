import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { system } from 'lib/system.js'

const { assert } = spin

const { createIsolate } = spin.load('spin').spin

function getArgs (args) {
  return new Uint32Array(0)
}

function spawnJS (main = '', js = '', argc = 0, argv = [], buf = new Uint8Array(0), fd = 0) {
  return createIsolate(argc, getArgs(argv), main, main.length, js, js.length,
    buf, buf.length, fd, 0, 'spin', 'foo.js', 1, 0, 0)
}

function spawn (code) {
  assert(spawnJS(code) === 0, 'could not run code')
}

const src = '1'
let done = 0

const eventLoop = new Loop()

const timer = new Timer(eventLoop, 1000, () => {
  console.log(`isolates ${done} rss ${system.getrusage()[0]}`)
  done = 0
})

while (1) {
  spawn(src)
  done++
  spin.runMicroTasks()
  eventLoop.poll(0)
}

timer.close()
