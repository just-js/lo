const { libssl } = spin.load('libssl')

const { assert } = spin

const handle = new Uint32Array(2)

function get (u32) {
  return u32[0] + ((2 ** 32) * u32[1])    
}

const sizes = {
  md5: 16, sha1: 20, sha256: 32, sha384: 48, sha512: 64
}

libssl.EVP_get_digestbyname = spin.wrap(handle, libssl.EVP_get_digestbyname, 1)
libssl.EVP_MD_CTX_new = spin.wrap(handle, libssl.EVP_MD_CTX_new, 0)

const method = 'md5'
const hasher = libssl.EVP_get_digestbyname(method)
assert(hasher)
const ctx = libssl.EVP_MD_CTX_new()
assert(ctx)

const encoder = new TextEncoder()
const hello = encoder.encode('hello')
assert(libssl.EVP_DigestInit_ex(ctx, hasher, 0) === 1)
assert(libssl.EVP_DigestUpdate(ctx, hello, hello.byteLength) === 1)
const hashSize = sizes[method]

const digest = new Uint8Array(hashSize)
const size = new Uint32Array(2)
assert(libssl.EVP_DigestFinal(ctx, digest, size) === 1)
console.log(get(size))
assert(get(size) === hashSize)

const expected = [ 93, 65, 64, 42, 188, 75, 42, 118, 185, 113, 157, 145, 16, 23, 197, 146 ]
digest.some((v, i) => assert(v === expected[i]))
