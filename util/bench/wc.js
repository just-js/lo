/*
taskset --cpu-list 6 dd status=
none if=/dev/zero bs=65536 count=1000000 | taskset --cpu-list 7 ./spin util/bench/wc.js
*/
import { bind } from 'lib/fast.js'
const { hrtime, dlsym, ptr } = spin
const read = bind(dlsym(0, 'read'), 'i32', ['i32', 'pointer', 'i32'])
const buf = ptr(new Uint8Array(65536))
const len = buf.length
let total = 0
const start = hrtime()
let bytes = read(0, buf.ptr, len)
while (bytes = read(0, buf.ptr, len)) total += bytes
const end = hrtime()
const elapsed = end - start
let rate = Math.ceil(total / (elapsed / 1e9))
if (rate < 1000) {
  console.log(`${rate} Bytes p/sec`)
} else if (rate < 1000 * 1000) {
  console.log(`${rate / 1000} KBytes p/sec`)
} else if (rate < 1000 * 1000 * 1000) {
  console.log(`${rate / (1000 * 1000)} MBytes p/sec`)
} else {
  console.log(`${rate / (1000 * 1000 * 1000)} GBytes p/sec`)
}
