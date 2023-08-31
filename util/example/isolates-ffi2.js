import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { bind } from 'lib/fast.js'
import { system } from 'lib/system.js'

const { dlsym, assert } = spin

const createIsolate = bind(dlsym(0, 'spin_create_isolate'), 'i32', [
  'i32', 'u32array', 'string', 'u32', 'string', 'u32', 'buffer', 'i32', 'i32',
  'u64', 'string', 'string', 'i32', 'i32', 'pointer'
])

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

//const src = `spin.library('fs').fs.write_string(2, 'hello\\n')`
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
  //gc()
}

timer.close()
console.log(createIsolate.state)
// 500 isolates a second
