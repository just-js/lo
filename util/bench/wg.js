import { run } from 'lib/bench.js'

const { wireguard } = spin.load('wireguard')

const b64 = 'vZlMApDIoHSLbb9BWfbuR4kzcMqNLltp4OgOSNnJY0Y='

const key = new Uint8Array(32)
const base64 = new Uint8Array(45)
const encoder = new TextEncoder()

encoder.encodeInto(b64, base64)

console.log(base64)
console.log(key)
const rc = wireguard.keyfrombase64(key, base64)
console.log(rc)
console.log(key)

const base642 = new Uint8Array(45)
console.log(base642)
wireguard.keytobase64(base642, key)
console.log(base642)

//run('keyfrombase64', () => wireguard.keyfrombase64(key, base64), 10000000, 10)
run('keytobase64', () => wireguard.keytobase64(base642, key), 10000000, 10)
