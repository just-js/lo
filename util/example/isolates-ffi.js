import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { FFIFunction, Types } from 'lib/ffi.js'
import { system } from 'lib/system.js'

const { dlsym, assert } = spin

const ffifn = new FFIFunction(dlsym(0, 'spin_create_isolate'), Types.i32, [
  Types.i32, Types.u32array, Types.string, Types.u32, Types.string, Types.u32,
  Types.buffer, Types.i32, Types.i32, Types.u64, Types.string, Types.string,
  Types.i32, Types.i32, Types.pointer
])

const createIsolate = ffifn.prepare().call

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

// 500 isolates a second
