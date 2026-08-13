// WORK.E.1 prototype verification (doc/WORK.E.1.md): exercises every
// function lib/encode_abi/api.js declares through lo.library('encode_abi'),
// checking output against known-correct reference values.

// lo.library() nests every binding's exports under its own name (verified
// against the real lo binary's `lo.library('system')` -> {system: {...}}
// too -- not specific to this prototype).
const encode_abi = lo.library('encode_abi').encode_abi
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function ptr (buf) {
  if (!buf.ptr) buf.ptr = lo.get_address(buf)
  return buf.ptr
}

let failed = false
function check (name, actual, expected) {
  const ok = actual === expected
  lo.print(`${ok ? 'PASS' : 'FAIL'} ${name}: ${JSON.stringify(actual)} ${ok ? '' : `(expected ${JSON.stringify(expected)})`}`)
  if (!ok) failed = true
}

// hex_encode(src, slen, dst, dlen) -> u32
{
  const src = encoder.encode('hello')
  const dst = new Uint8Array(64)
  const n = encode_abi.hex_encode(ptr(src), src.length, ptr(dst), dst.length)
  check('hex_encode', decoder.decode(dst.subarray(0, n)), '68656c6c6f')
}

// hex_decode(dst, dlen, src, slen) -> u32
{
  const src = encoder.encode('68656c6c6f')
  const dst = new Uint8Array(64)
  const n = encode_abi.hex_decode(ptr(dst), dst.length, ptr(src), src.length)
  check('hex_decode', decoder.decode(dst.subarray(0, n)), 'hello')
}

// base64_encode(src, slen, dst, dlen) -> u32
{
  const src = encoder.encode('hello world')
  const dst = new Uint8Array(64)
  const n = encode_abi.base64_encode(ptr(src), src.length, ptr(dst), dst.length)
  check('base64_encode', decoder.decode(dst.subarray(0, n)), 'aGVsbG8gd29ybGQ=')
}

// base64_encode_str(src: string, slen, dst, dlen) -> u32 -- exercises the
// LO_STRING generic-dispatch path (real JS string in, not a buffer address)
{
  const dst = new Uint8Array(64)
  const n = encode_abi.base64_encode_str('hello world', 11, ptr(dst), dst.length)
  check('base64_encode_str', decoder.decode(dst.subarray(0, n)), 'aGVsbG8gd29ybGQ=')
}

// base64_decode(dst, dlen, src, slen) -> u32
{
  const src = encoder.encode('aGVsbG8gd29ybGQ=')
  const dst = new Uint8Array(64)
  const n = encode_abi.base64_decode(ptr(dst), dst.length, ptr(src), src.length)
  check('base64_decode', decoder.decode(dst.subarray(0, n)), 'hello world')
}

// base64_decode_str(dst, dlen, src: string, slen) -> u32 -- LO_STRING again,
// this time as the third parameter instead of the first
{
  const dst = new Uint8Array(64)
  const n = encode_abi.base64_decode_str(ptr(dst), dst.length, 'aGVsbG8gd29ybGQ=', 16)
  check('base64_decode_str', decoder.decode(dst.subarray(0, n)), 'hello world')
}

lo.print(failed ? '\nFAILED' : '\nALL PASSED')
lo.exit(failed ? 1 : 0)
