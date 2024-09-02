let libssl
if (lo.getenv('LOSSL') === 'boringssl') {
  libssl = lo.load('boringssl').boringssl
} else {
  libssl = lo.load('libssl').libssl
}

const { assert, ptr, wrap } = lo

const sizes = {
  md5: 16, sha1: 20, sha256: 32, sha384: 48, sha512: 64
}

const handle = new Uint32Array(2)

libssl.EVP_get_digestbyname = wrap(handle, libssl.EVP_get_digestbyname, 1)
libssl.EVP_MD_CTX_new = wrap(handle, libssl.EVP_MD_CTX_new, 0)

const {
  EVP_get_digestbyname, EVP_MD_CTX_new, EVP_DigestInit_ex, 
  EVP_DigestUpdateBuffer, EVP_DigestFinal, EVP_MD_CTX_reset, EVP_Digest,
  EVP_DigestUpdateString, EVP_DigestUpdate
} = libssl

class Digest {
  method = 'md5'

  constructor (method = 'md5') {
    const size = sizes[method]
    this.method = method
    this.hasher = EVP_get_digestbyname(method)
    this.hsize = new Uint32Array(2)
    this.digest = ptr(new Uint8Array(size))
    this.ctx = EVP_MD_CTX_new()
  }

  init () {
    assert(EVP_DigestInit_ex(this.ctx, this.hasher, 0) === 1)
  }

  update (buf) {
    assert(EVP_DigestUpdateBuffer(this.ctx, buf, buf.length) === 1)
  }

  finish () {
    const { hsize, digest, ctx } = this
    assert(EVP_DigestFinal(ctx, digest, hsize) === 1)
    EVP_MD_CTX_reset(ctx)
    return digest
  }

  hash (buf) {
    const { hasher, hsize, digest, ctx } = this
    assert(EVP_DigestInit_ex(ctx, hasher, 0) === 1)
    assert(EVP_DigestUpdateBuffer(ctx, buf, buf.length) === 1)
    assert(EVP_DigestFinal(ctx, digest, hsize) === 1)
    EVP_MD_CTX_reset(ctx)
    return digest
  }

  hash_string (str) {
    const { hasher, hsize, digest, ctx } = this
    assert(EVP_DigestInit_ex(ctx, hasher, 0) === 1)
    assert(EVP_DigestUpdateString(ctx, str) === 1)
    assert(EVP_DigestFinal(ctx, digest, hsize) === 1)
    EVP_MD_CTX_reset(ctx)
    return digest
  }

  hash_pointer (c_str) {
    const { hasher, hsize, digest, ctx } = this
    assert(EVP_DigestInit_ex(ctx, hasher, 0) === 1)
    assert(EVP_DigestUpdate(ctx, c_str.ptr, c_str.size) === 1)
    assert(EVP_DigestFinal(ctx, digest, hsize) === 1)
    EVP_MD_CTX_reset(ctx)
    return digest
  }

  hashonce (buf) {
    const { hasher, hsize, digest } = this
    assert(EVP_Digest(buf, buf.length, digest, hsize, hasher, 0) === 1)
    return digest
  }
}

export { Digest }
