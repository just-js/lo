let libssl
if (lo.getenv('LOSSL') === 'boringssl') {
  libssl = lo.load('boringssl').boringssl
} else {
  libssl = lo.load('libssl').libssl
}

const { encode } = lo.load('encode')

const { assert, ptr, utf8_decode } = lo

const sizes = {
  md5: 16, sha1: 20, sha256: 32, sha384: 48, sha512: 64
}

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
    this.hasher = assert(EVP_get_digestbyname(method))
    this.hsize = ptr(new Uint32Array(2))
    this.digest = ptr(new Uint8Array(size))
    this.ctx = assert(EVP_MD_CTX_new())
  }

  init () {
    assert(EVP_DigestInit_ex(this.ctx, this.hasher, 0) === 1)
  }

  update (buf) {
    assert(EVP_DigestUpdateBuffer(this.ctx, ptr(buf).ptr, buf.length) === 1)
  }

  finish () {
    const { hsize, digest, ctx } = this
    assert(EVP_DigestFinal(ctx, digest.ptr, hsize.ptr) === 1)
    EVP_MD_CTX_reset(ctx)
    return digest
  }

  hash (buf) {
    const { hasher, hsize, digest, ctx } = this
    assert(EVP_DigestInit_ex(ctx, hasher, 0) === 1)
    assert(EVP_DigestUpdateBuffer(ctx, ptr(buf).ptr, buf.length) === 1)
    assert(EVP_DigestFinal(ctx, digest.ptr, hsize.ptr) === 1)
    EVP_MD_CTX_reset(ctx)
    return digest
  }

  hash_string (str) {
    const { hasher, hsize, digest, ctx } = this
    assert(EVP_DigestInit_ex(ctx, hasher, 0) === 1)
    assert(EVP_DigestUpdateString(ctx, str) === 1)
    assert(EVP_DigestFinal(ctx, digest.ptr, hsize.ptr) === 1)
    EVP_MD_CTX_reset(ctx)
    return digest
  }

  hash_pointer (c_str) {
    const { hasher, hsize, digest, ctx } = this
    assert(EVP_DigestInit_ex(ctx, hasher, 0) === 1)
    assert(EVP_DigestUpdate(ctx, c_str.ptr, c_str.size) === 1)
    assert(EVP_DigestFinal(ctx, digest.ptr, hsize.ptr) === 1)
    EVP_MD_CTX_reset(ctx)
    return digest
  }

  hashonce (buf) {
    const { hasher, hsize, digest } = this
    assert(EVP_Digest(ptr(buf).ptr, buf.length, digest.ptr, hsize.ptr, hasher, 0) === 1)
    return digest
  }
}

function hex_encode (digest) {
  const hex_encoded = ptr(new Uint8Array(digest.length * 2))
  const size = encode.hex_encode(digest.ptr, digest.length, hex_encoded.ptr, hex_encoded.length)
  return utf8_decode(hex_encoded.ptr, size)
}

export { Digest, hex_encode }
