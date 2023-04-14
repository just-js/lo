import { run } from 'lib/bench.js'

const { utf8Length } = spin
const encoder = new TextEncoder()
const u8 = new Uint8Array(utf8Length('hello'))

//run('utf8encode', () => encoder.encode('hello'), 30000000, 10)
run('utf8encodeInto', () => encoder.encodeInto('hello', u8), 180000000, 10)
