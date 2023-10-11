import * as _ from 'lib/compat.js'
import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'

const loop = new Loop()

const timer = new Timer(loop, 1000, () => {
  console.log(runtime.mem())
})

while(loop.poll(-1) > 0) {}

timer.close()
