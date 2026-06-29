import { Bench } from 'lib/bench.js'

const { assert, ptr } = lo

const libssl = lo.library('boringssl').boringssl

const {
  EVP_get_digestbyname, EVP_MD_CTX_new, EVP_DigestInit_ex, EVP_DigestUpdate, EVP_DigestFinal_ex, EVP_Digest
} = libssl

const sha256_hasher = EVP_get_digestbyname('sha256')
const sha256_hsize = ptr(new Uint32Array(2))
const sha256_digest = ptr(new Uint8Array(32))
const sha256_ctx = EVP_MD_CTX_new()

function sha256_hash_ptr (u8) {
  assert(EVP_DigestInit_ex(sha256_ctx, sha256_hasher, 0) === 1)
  assert(EVP_DigestUpdate(sha256_ctx, u8.ptr, u8.length) === 1)
  assert(EVP_DigestFinal_ex(sha256_ctx, sha256_digest.ptr, sha256_hsize.ptr) === 1)
  return sha256_digest
}

function sha256_digest_ptr (u8) {
  assert(EVP_Digest(u8.ptr, u8.length, sha256_digest.ptr, sha256_hsize.ptr, sha256_hasher, 0) === 1)
  return sha256_digest
}

const encoder = new TextEncoder()
const hello = ptr(encoder.encode('hello\n'))

const expectedsha256 = [ 
  0x58, 0x91, 0xb5, 0xb5, 0x22, 0xd5, 0xdf, 0x08, 0x6d, 0x0f, 0xf0, 0xb1, 0x10, 0xfb, 0xd9, 0xd2,
  0x1b, 0xb4, 0xfc, 0x71, 0x63, 0xaf, 0x34, 0xd0, 0x82, 0x86, 0xa2, 0xe8, 0x46, 0xf6, 0xbe, 0x03
]

sha256_hash_ptr(hello).forEach((v, i) => assert(v === expectedsha256[i]))
sha256_digest_ptr(hello).forEach((v, i) => assert(v === expectedsha256[i]))

const iter = parseInt(args[0] || '5', 10)
const runs = parseInt(args[1] || '3000000', 10)
let total = parseInt(args[2] || '1', 10)
const bench = new Bench()

while (total--) {

for (let i = 0; i < iter; i++) {
  bench.start('sha256_digest_ptr')
  for (let j = 0; j < runs; j++) {
    sha256_digest_ptr(hello)
  }
  bench.end(runs, hello.length)
}

for (let i = 0; i < iter; i++) {
  bench.start('sha256_hash_ptr')
  for (let j = 0; j < runs; j++) {
    sha256_hash_ptr(hello)
  }
  bench.end(runs, hello.length)
}

}
