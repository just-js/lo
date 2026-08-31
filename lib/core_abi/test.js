// Standard test.js entrypoint (`lo lib/core_abi/test.js`) -- real
// syscalls through the abi target, not just a "does it compile" check.
// See lib/core_abi/api.js's own header comment for what's deliberately
// dropped from the real lib/core and why (E.5/E.9, doc/WORK.E.1.md).
//
// 'buffer'/'pointer' params take the raw pointer number (ptr()/
// get_address()), not a TypedArray object directly -- same convention
// as every real lib/*/api.js binding (lib/gen.js's getSlowParameterCast/
// getFastParameterCast active code path for 'buffer', not the
// commented-out Uint8Array-auto-unwrap version).

const { assert, ptr } = lo

async function test () {
  const { core_abi: c } = lo.load('core_abi')

  assert(typeof c.getpid() === 'number', 'getpid')

  // open/write/read/close/unlink round trip on a real file
  const path = '/tmp/core_abi_test.txt'
  const fd = c.open(path, c.O_WRONLY | c.O_CREAT | c.O_TRUNC, 0o644)
  assert(fd > 0, 'open')
  const wbuf = ptr(new Uint8Array([104, 101, 108, 108, 111])) // "hello"
  assert(c.write(fd, wbuf.ptr, wbuf.length) === 5, 'write')
  assert(c.close(fd) === 0, 'close')

  const fd2 = c.open(path, c.O_RDONLY, 0)
  assert(fd2 > 0, 'open (read)')
  const rbuf = ptr(new Uint8Array(16))
  const rn = c.read(fd2, rbuf.ptr, rbuf.length)
  assert(rn === 5, 'read')
  assert(Array.from(rbuf.slice(0, rn)).map(b => String.fromCharCode(b)).join('') === 'hello', 'read content')
  assert(c.close(fd2) === 0, 'close (read)')
  assert(c.unlink(path) === 0, 'unlink')

  // malloc/memset/free
  const p = c.malloc(16)
  assert(p !== 0, 'malloc')
  assert(c.memset(p, 65, 16) === p, 'memset')
  c.free(p)

  // dlopen/dlsym/dlclose against libc itself
  const handle = c.dlopen('libc.so.6', c.RTLD_NOW)
  assert(handle !== 0, 'dlopen')
  assert(c.dlsym(handle, 'malloc') !== 0, 'dlsym')
  assert(c.dlclose(handle) === 0, 'dlclose')

  // stat a real file into a correctly-sized buffer (struct_struct_stat_size:
  // the double "struct_" prefix is real, shared with the V8-codegen path's
  // own initStruct naming -- see doc/WORK.md's E.9 correction)
  const statbuf = ptr(new Uint8Array(c.struct_struct_stat_size))
  assert(c.stat('/etc/passwd', statbuf.ptr) === 0, 'stat')

  // getenv returns a real, nonzero pointer for a variable known to be set
  assert(c.getenv('HOME') !== 0, 'getenv')

  console.log('core_abi: ok')
}

export { test }
