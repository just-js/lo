//import { run } from '../../../lib/bench.js'
import { run } from 'lib/bench.js'

const encoder = new TextEncoder()
const u8 = new Uint8Array(1024)

//run('utf8encode', () => encoder.encode('hello'), 30000000, 10)
run('utf8encodeInto', () => encoder.encodeInto('Hello, World!', u8), 180000000, 10)
