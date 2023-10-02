import { run } from 'lib/bench.js'
import { dump } from 'lib/binary.js'

const { encode } = spin.load('encode')

const { hex_encode, base64_encode } = encode

const out = new Uint8Array(32)
const u8 = new Uint8Array((new Uint8Array(16)).fill(0).map(v => Math.ceil(Math.random() * 255)))
console.log(u8)

const bytes = hex_encode(u8, 16, out, out.length)
console.log(bytes)
console.log(dump(out))

//run('hex_encode', () => hex_encode(u8, 16, out, out.length), 40000000, 10)
run('base64_encode', () => base64_encode(u8, 16, out, out.length), 40000000, 10)
