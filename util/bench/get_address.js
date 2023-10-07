import { Bench } from './lib/bench.js'

const {
  assert, getAddress, getAddressSlow, getAddress2Slow
} = spin

const bench = new Bench()

const ab = new ArrayBuffer(1024)
const u8 = new Uint8Array(ab)
const runs = 200000000

assert(getAddressSlow(u8) === getAddress(u8))
assert(getAddress2Slow(ab) === getAddress(u8))

console.log(getAddress2Slow.state)

while (1) {

  for (let i = 0; i < 5; i++) {
  bench.start('getAddress')
  for (let j = 0; j < runs; j++) {
    getAddress(u8)
  }
  bench.end(runs)
}

for (let i = 0; i < 5; i++) {
  bench.start('getAddressSlow')
  for (let j = 0; j < runs; j++) {
    getAddressSlow(u8)
  }
  bench.end(runs)
}

for (let i = 0; i < 5; i++) {
  bench.start('getAddress2Slow')
  for (let j = 0; j < runs; j++) {
    getAddress2Slow(ab)
  }
  bench.end(runs)
}

}
