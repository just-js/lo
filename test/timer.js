import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'

const { assert } = lo

const loop = new Loop()
let counter = 0
const timer = new Timer(loop, 1000, () => {
  console.log('timer')
  counter++
  if (counter === 5) timer.close()
})
while (loop.poll() > 0) {}
assert(counter === 5)
