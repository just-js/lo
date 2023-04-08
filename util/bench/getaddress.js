import { run } from 'lib/bench.js'

const { getAddress, assert } = spin

const u8 = new Uint8Array(100)

const sub = u8.subarray(4)
const expected = getAddress(sub)

for (let i = 0; i < 100000000; i++) assert(getAddress(sub) === expected)

run('fastcall', () => getAddress(u8), 300000000, 10)
