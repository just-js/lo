const { assert, ptr, fs, args } = spin
const { sendfile, fstat } = fs
assert(args.length > 1)
const stat = new Uint8Array(160)
const st = new BigUint64Array(stat.buffer)
const fd = fs.open(args[2], 0, 0)
assert(fd > 2)
const off_t = ptr(new Uint8Array(8))
const fp = off_t.ptr
while (sendfile(1, fd, fp, 524288) > 0) {}
