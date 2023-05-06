const buf = new Uint8Array(65536)
let total = 0
let bytes = spin.fs.read(0, buf, buf.length)
while (bytes > 0) {
  total += bytes
  bytes = spin.fs.read(0, buf, buf.length)
}
console.log(total)
