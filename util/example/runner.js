import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { system } from 'lib/system.js'
import { thread } from 'lib/thread.js'
import { net } from 'lib/net.js'

const { fs, fd, buffer } = spin
const { O_NONBLOCK } = net.constants

const eventLoop = new Loop()

const buf = new Uint8Array(buffer)

const timer = new Timer(eventLoop, 1000, () => {
  fs.write(fd, u8, 8)
  const v = Math.floor(Math.random() * 10)
  for (let i = 0; i < 10000; i++) buf.fill(v)
})

const [, name] = spin.args
const tid = system.gettid()
const self = thread.self()
const u8 = new Uint8Array(new BigUint64Array([BigInt(self)]).buffer)

fs.fcntl(fd, O_NONBLOCK, 0)

while (1) {
  spin.runMicroTasks()
  eventLoop.poll(-1)
}

timer.close()
