import { Registers, compiler, asm } from 'lib/asm.js'
import { bind } from 'lib/ffi.js'
import { Bench } from 'lib/bench.js'

const { rdi, rsi, rdx, rbx, rax } = Registers
const { core, ptr, assert, utf8_length } = lo
const { dlsym, dlopen, RTLD_NOW, RTLD_LOCAL } = core
const sizes = {
  md5: 16, sha1: 20, sha256: 32, sha384: 48, sha512: 64
}

const encoder = new TextEncoder()
const handle = assert(dlopen('../lib/boringssl/deps/boringssl/build/libcrypto.so', RTLD_NOW | RTLD_LOCAL))
const EVP_MD_CTX_new_sym = assert(dlsym(handle, 'EVP_MD_CTX_new'))
const EVP_DigestInit_ex_sym = assert(dlsym(handle, 'EVP_DigestInit_ex'))
const EVP_DigestUpdate_sym = assert(dlsym(handle, 'EVP_DigestUpdate'))
const EVP_DigestFinal_ex_sym = assert(dlsym(handle, 'EVP_DigestFinal_ex'))
const EVP_sha1_sym = assert(dlsym(handle, 'EVP_sha1'))
const EVP_sha256_sym = assert(dlsym(handle, 'EVP_sha256'))
const EVP_md5_sym = assert(dlsym(handle, 'EVP_md5'))
const EVP_MD_CTX_new = bind(EVP_MD_CTX_new_sym, 'pointer', [])
const EVP_sha1 = bind(EVP_sha1_sym, 'pointer', [])
const EVP_md5 = bind(EVP_md5_sym, 'pointer', [])
const EVP_sha256 = bind(EVP_sha256_sym, 'pointer', [])
const hash_types = {
  md5: EVP_md5(),
  sha1: EVP_sha1(),
  sha256: EVP_sha256(),
}

function bind_fast_hash (hash_context, hash_type, digest_ptr, hsize_ptr) {
  asm.reset()
    .push(rsi)
    .push(rdx)
    .movabs(hash_context, rdi)
    .movabs(hash_type, rsi)
    .zero(rdx)
    .push(rdi)
    .call(EVP_DigestInit_ex_sym)
    .pop(rdi)
    .pop(rdx)
    .pop(rsi)
    .push(rdi)
    .call(EVP_DigestUpdate_sym)
    .pop(rdi)
    .movabs(digest_ptr, rsi)
    .movabs(hsize_ptr, rdx)
    .jmp(EVP_DigestFinal_ex_sym)
    .pad()
  const fast_len = asm.size
  asm.push(rbx)
    .movreg(rdi, rbx)
    .movabs(hash_context, rdi)
    .movabs(hash_type, rsi)
    .zero(rdx)
    .push(rdi)
    .call(EVP_DigestInit_ex_sym)
    .pop(rdi)
    .movsrc(rbx, rsi, 8)
    .movsrc(rbx, rdx, 16)
    .push(rdi)
    .call(EVP_DigestUpdate_sym)
    .pop(rdi)
    .movabs(digest_ptr, rsi)
    .movabs(hsize_ptr, rdx)
    .call(EVP_DigestFinal_ex_sym)
    .movdest(rax, rbx, 0)
    .pop(rbx)
    .ret()
  console.log(asm.src)
  const addr = compiler.compile(asm.bytes())
  const fast_addr = addr
  const slow_addr = addr + fast_len
  const pointer = bind(0, 'i32', ['pointer', 'u32'], false, fast_addr, slow_addr)
  const string = bind(0, 'i32', ['string', 'u32'], false, fast_addr, slow_addr)
  return { pointer, string }
}

class FastHash {
  #size = ptr(new Uint32Array(0))
  #hash
  #hash_str

  constructor (type = 'md5') {
    const size = sizes[type]
    const hash_type = hash_types[type]
    const hash_context = assert(EVP_MD_CTX_new())
    const hash_hsize = ptr(new Uint32Array(2))
    const hash_digest = ptr(new Uint8Array(size))
    // todo: cache these
    const { pointer, string } = bind_fast_hash(hash_context, hash_type, hash_digest.ptr, hash_hsize.ptr)
    this.#hash = pointer
    this.#hash_str = string
    this.digest = hash_digest
    this.#size = hash_hsize
  }

  get size () {
    return this.#size[0]
  }

  hash (src) {
    assert(this.#hash(src.ptr, src.length) === 1)
  }

  hash_create (src) {
    this.hash(src)
    return this.digest.slice(0, this.size)
  }

  hash_string (src) {
    assert(this.#hash_str(src, utf8_length(src)) === 1)
  }

  hash_string_create (src) {
    this.hash_string(src)
    return this.digest.slice(0, this.size)
  }
}

const iter = parseInt(args[0] || '5', 10)
const bench = new Bench()

const h = new FastHash('sha256')
const str = 'hello\n'
const u8 = ptr(encoder.encode(str))

const expectedsha256 = [ 
  0x58, 0x91, 0xb5, 0xb5, 0x22, 0xd5, 0xdf, 0x08, 0x6d, 0x0f, 0xf0, 0xb1, 0x10, 0xfb, 0xd9, 0xd2,
  0x1b, 0xb4, 0xfc, 0x71, 0x63, 0xaf, 0x34, 0xd0, 0x82, 0x86, 0xa2, 0xe8, 0x46, 0xf6, 0xbe, 0x03
]

h.hash_string(str)
console.log(Array.from(h.digest).map(n => n.toString(16)).join(', '))
h.digest.forEach((v, i) => assert(v === expectedsha256[i]))
h.digest.fill(0)
h.hash(u8)
console.log(Array.from(h.digest).map(n => n.toString(16)).join(', '))
h.digest.forEach((v, i) => assert(v === expectedsha256[i]))
h.digest.fill(0)


{
  const runs = 3000000
  for (let i = 0; i < iter; i++) {
    bench.start('fasthash')
    for (let j = 0; j < runs; j++) h.hash(u8)
    bench.end(runs, u8.length)
  }
}

console.log(Array.from(h.digest).map(n => n.toString(16)).join(', '))
h.digest.forEach((v, i) => assert(v === expectedsha256[i]))

{
  const runs = 3000000
  for (let i = 0; i < iter; i++) {
    bench.start('fasthash-string')
    for (let j = 0; j < runs; j++) h.hash_string(str)
    bench.end(runs, u8.length)
  }
}

console.log(Array.from(h.digest).map(n => n.toString(16)).join(', '))
h.digest.forEach((v, i) => assert(v === expectedsha256[i]))
