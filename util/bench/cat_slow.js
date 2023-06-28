const buf = new Uint8Array(65536 * 2)
const { assert } = spin
const { open, read, write } = spin.fs
const O_RDONLY = 0
const STDOUT = 1
assert(spin.args.length > 1)
const fd = open(spin.args[2], O_RDONLY, 0)
assert(fd > 2)
let bytes = read(fd, buf, buf.length)
while (bytes > 0) {
  const written = write(STDOUT, buf, bytes)
  assert(written === bytes)
  bytes = read(fd, buf, buf.length)
}
