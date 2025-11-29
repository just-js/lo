import { api } from 'lib/libssl/api.js'

let libssl
if (lo.getenv('LOSSL') === 'boringssl') {
  libssl = lo.load('boringssl').boringssl
} else {
  libssl = lo.load('libssl').libssl
}

const { wrap, assert, ptr, addr, cstr } = lo

const {
  SSL_OP_ALL, SSL_OP_NO_RENEGOTIATION, SSL_OP_NO_SSLv3, SSL_OP_NO_TLSv1, 
  SSL_OP_NO_TLSv1_1, SSL_OP_NO_DTLSv1, SSL_OP_NO_DTLSv1_2, SSL_OP_NO_COMPRESSION
} = libssl


const {
  EVP_PKEY_CTX_new_id, EVP_PKEY_keygen_init, EVP_PKEY_keygen, EVP_PKEY_CTX_free, 
  EVP_sha512, BIO_s_mem, BIO_new, BIO_ctrl, BIO_read, PEM_write_bio_PrivateKey, 
  PEM_write_bio_PUBKEY, RSA_pkey_ctx_ctrl, EVP_PKEY_RSA, EVP_PKEY_OP_KEYGEN,
  EVP_PKEY_CTRL_RSA_KEYGEN_BITS, BIO_CTRL_PENDING, X509_new, ASN1_INTEGER_set,
  X509_get_serialNumber, X509_getm_notBefore, X509_getm_notAfter,
  X509_gmtime_adj, X509_set_pubkey, X509_sign, PEM_write_bio_X509,
  X509_get_subject_name, X509_NAME_add_entry_by_txt, X509_set_issuer_name,
  X509_free, BIO_free, EVP_PKEY_free, EVP_PKEY_X25519, EVP_PKEY_ED25519
} = libssl

libssl.default_options = SSL_OP_ALL | SSL_OP_NO_RENEGOTIATION | SSL_OP_NO_SSLv3 | 
  SSL_OP_NO_TLSv1 | SSL_OP_NO_TLSv1_1 | SSL_OP_NO_DTLSv1 | SSL_OP_NO_DTLSv1_2 |
  SSL_OP_NO_COMPRESSION

const CertTypes = {
  X25519: EVP_PKEY_X25519,
  ED25519: EVP_PKEY_ED25519,
  RSA: EVP_PKEY_RSA
}

function create_keypair (opts) {
  const { bits = 2048, type = CertTypes.RSA } = opts
  const key_ctx = assert(EVP_PKEY_CTX_new_id(type, 0))
  assert(EVP_PKEY_keygen_init(key_ctx) === 1)
  if (type === CertTypes.RSA && bits) {
    assert(RSA_pkey_ctx_ctrl(key_ctx, EVP_PKEY_OP_KEYGEN, 
      EVP_PKEY_CTRL_RSA_KEYGEN_BITS, bits, 0) > 0)
  }
  const key = ptr(new Uint32Array(2))
  assert(EVP_PKEY_keygen(key_ctx, key.ptr) === 1)
  EVP_PKEY_CTX_free(key_ctx)
  const biopriv = assert(BIO_new(BIO_s_mem()))
  assert(PEM_write_bio_PrivateKey(biopriv, addr(key), 0, 0, 0, 0, 0) === 1)
  let size = BIO_ctrl(biopriv, BIO_CTRL_PENDING, 0, 0)
  assert(size > 0)
  const privkey = ptr(new Uint8Array(size))
  assert(BIO_read(biopriv, privkey.ptr, size) > 0)
  const biopub = assert(BIO_new(BIO_s_mem()))
  assert(PEM_write_bio_PUBKEY(biopub, addr(key)) === 1)
  size = BIO_ctrl(biopub, BIO_CTRL_PENDING, 0, 0)
  assert(size > 0)
  const pubkey = ptr(new Uint8Array(size))
  assert(BIO_read(biopub, pubkey.ptr, size) > 0)
  BIO_free(biopriv)
  BIO_free(biopub)
  return { pubkey, privkey, key_ptr: addr(key) }
}

function generate_cert (key, opts) {
  const {
    country, province, city, org, hostname, type = CertTypes.RSA
  } = opts
  const cert = assert(X509_new())
  assert(ASN1_INTEGER_set(assert(X509_get_serialNumber(cert)), 1) === 1)
  X509_gmtime_adj(assert(X509_getm_notBefore(cert)), 0);
  X509_gmtime_adj(assert(X509_getm_notAfter(cert)), 31536000);
  assert(X509_set_pubkey(cert, key.key_ptr) === 1)
  const name = assert(X509_get_subject_name(cert))
  assert(X509_NAME_add_entry_by_txt(name, C.ptr, MBSTRING_ASC, 
    cstr(country).ptr, -1, -1, 0) === 1)
  assert(X509_NAME_add_entry_by_txt(name, ST.ptr, MBSTRING_ASC, 
    cstr(province).ptr, -1, -1, 0) === 1)
  assert(X509_NAME_add_entry_by_txt(name, L.ptr, MBSTRING_ASC, 
    cstr(city).ptr, -1, -1, 0) === 1)
  assert(X509_NAME_add_entry_by_txt(name, O.ptr, MBSTRING_ASC, 
    cstr(org).ptr, -1, -1, 0) === 1)
  assert(X509_NAME_add_entry_by_txt(name, CN.ptr, MBSTRING_ASC, 
    cstr(hostname).ptr, -1, -1, 0) === 1)
  assert(X509_set_issuer_name(cert, name) === 1)
  if (type === CertTypes.RSA) {
    assert(X509_sign(cert, key.key_ptr, assert(EVP_sha512())) > 0)
  } else {
    assert(X509_sign(cert, key.key_ptr, 0) > 0)
  }
  const x509pub = assert(BIO_new(BIO_s_mem()))
  assert(PEM_write_bio_X509(x509pub, cert) === 1)
  const size = BIO_ctrl(x509pub, BIO_CTRL_PENDING, 0, 0)
  assert(size > 0)
  const x509 = ptr(new Uint8Array(size))
  assert(BIO_read(x509pub, x509.ptr, size) > 0)
  BIO_free(x509pub)
  return { x509, cert_ptr: cert }
}

function free_cert (cert) {
  assert(X509_free(cert.cert_ptr) === undefined)
}

function free_keypair (key) {
  assert(EVP_PKEY_free(key.key_ptr) === undefined)
}

const C = cstr('C')
const ST = cstr('ST')
const L = cstr('L')
const O = cstr('O')
const CN = cstr('CN')
const MBSTRING_ASC = 0x1001

export { generate_cert, create_keypair, free_cert, free_keypair, CertTypes, libssl }
