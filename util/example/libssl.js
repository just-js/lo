import { api } from 'bindings/libssl/libssl.js'

const { cstr, assert, ptr, addr, utf8Decode } = spin

function createKeypair (bits = 2048) {
  const keyCtx = EVP_PKEY_CTX_new_id(EVP_PKEY_RSA, 0)
  assert(EVP_PKEY_keygen_init(keyCtx) === 1)
  assert(RSA_pkey_ctx_ctrl(keyCtx, EVP_PKEY_OP_KEYGEN, 
    EVP_PKEY_CTRL_RSA_KEYGEN_BITS, bits, 0) > 0)
  const key = ptr(new Uint32Array(2))
  // generate key
  assert(EVP_PKEY_keygen(keyCtx, key.ptr) === 1)
  // create a place to dump the IO, in this case in memory
  EVP_PKEY_CTX_free(keyCtx)
  const biopriv = BIO_new(BIO_s_mem())
  assert(biopriv)
  // dump key to IO
  assert(PEM_write_bio_PrivateKey(biopriv, addr(key), 0, 0, 0, 0, 0) === 1)
  // get buffer length
  let size = BIO_ctrl(biopriv, BIO_CTRL_PENDING, 0, 0)
  assert(size > 0)
  // create char reference of private key length
  const privkey = ptr(new Uint8Array(size))
  // read the key from the buffer and put it in the char reference
  assert(BIO_read(biopriv, privkey.ptr, size) > 0)
  // extract public key as string
  // create a place to dump the IO, in this case in memory
  const biopub = BIO_new(BIO_s_mem())
  assert(biopub)
  // dump key to IO
  assert(PEM_write_bio_PUBKEY(biopub, addr(key)) === 1)
  // get buffer length
  size = BIO_ctrl(biopub, BIO_CTRL_PENDING, 0, 0)
  assert(size > 0)
  // create char reference of public key length
  const pubkey = ptr(new Uint8Array(size))
  // read the key from the buffer and put it in the char reference
  assert(BIO_read(biopub, pubkey.ptr, size) > 0)
  // at this point we can save the public somewhere
  return { pubkey, privkey }
}

function loadPublicKey (pubkey) {
  assert(pubkey.ptr)
  const biopub = BIO_new_mem_buf(pubkey.ptr, -1)
  assert(biopub !== 0)
  const rsa = PEM_read_bio_RSA_PUBKEY(biopub, 0, 0, 0)
  assert(rsa !== 0)
  const key = EVP_PKEY_new()
  assert(key)
  assert(EVP_PKEY_assign(key, EVP_PKEY_RSA, rsa) === 1)
  return key
}

function loadPrivateKey (privkey) {
  assert(privkey.ptr)
  const biopub = BIO_new_mem_buf(privkey.ptr, -1)
  assert(biopub !== 0)
  const rsa = PEM_read_bio_RSAPrivateKey(biopub, 0, 0, 0)
  assert(rsa !== 0)
  const key = EVP_PKEY_new()
  assert(key)
  assert(EVP_PKEY_assign(key, EVP_PKEY_RSA, rsa) === 1)
  return key
}

function loadCertificate (pem) {
  assert(pem.ptr)
  const biocert = BIO_new_mem_buf(pem.ptr, -1)
  assert(biocert !== 0)
  // todo: second arg is a far pointer - do we need to send an empty 8 byte buffer here?
  const x509 = PEM_read_bio_X509(biocert, 0, 0, 0)
  assert(x509 !== 0)
  return x509
}

function extractRSAPublicKey (x509) {
  const key = X509_get_pubkey(x509)
  assert(key)
  const id = EVP_PKEY_id(key)
  const type = EVP_PKEY_type(id)
  assert(type === EVP_PKEY_RSA2 || type === EVP_PKEY_RSA)
  const rsa = EVP_PKEY_get1_RSA(key)
  assert(rsa)
  const biokey = BIO_new(BIO_s_mem())
  assert(biokey)
  assert(PEM_write_bio_PUBKEY(biokey, key) === 1)
  let size = BIO_ctrl(biokey, BIO_CTRL_PENDING, 0, 0)
  assert(size > 0)
  const pubkey = ptr(new Uint8Array(size))
  assert(BIO_read(biokey, pubkey.ptr, size) > 0)
  return pubkey
}

function generateCSR (privkey, pubkey, hostname, opts) {
  assert(privkey && pubkey)
  const {
    country, province, city, org
  } = opts
  const req = X509_REQ_new()
  assert(req)
  // set the csr version - ??
  assert(X509_REQ_set_version(req, 0) === 1)
  // set the name details on the csr
  const name = X509_REQ_get_subject_name(req)
  assert(name)
  assert(X509_NAME_add_entry_by_txt(name, C.ptr, MBSTRING_ASC, cstr(country).ptr, -1, -1, 0) === 1)
  assert(X509_NAME_add_entry_by_txt(name, ST.ptr, MBSTRING_ASC, cstr(province).ptr, -1, -1, 0) === 1)
  assert(X509_NAME_add_entry_by_txt(name, L.ptr, MBSTRING_ASC, cstr(city).ptr, -1, -1, 0) === 1)
  assert(X509_NAME_add_entry_by_txt(name, O.ptr, MBSTRING_ASC, cstr(org).ptr, -1, -1, 0) === 1)
  assert(X509_NAME_add_entry_by_txt(name, CN.ptr, MBSTRING_ASC, cstr(hostname).ptr, -1, -1, 0) === 1)
  // set the public key on the csr
  assert(X509_REQ_set_pubkey(req, pubkey) === 1)
  // sign the csr with the private key
  const size = X509_REQ_sign(req, privkey, EVP_sha256())
  assert(size > 0)
  // write the csr to a bio
  const biocsr = BIO_new(BIO_s_mem())
  assert(biocsr)
  assert(PEM_write_bio_X509_REQ(biocsr, req) === 1)
  // write the csr to a buffer in pem format and return
  const pemsize = BIO_ctrl(biocsr, BIO_CTRL_PENDING, 0, 0)
  assert(pemsize > 0)
  const csr = ptr(new Uint8Array(pemsize))
  assert(BIO_read(biocsr, csr.ptr, pemsize) > 0)
  return csr
}

function sign (plaintext, pk) {
  assert(plaintext.ptr && pk)
  const ctx = EVP_MD_CTX_new()
  assert(ctx)
  const digest = EVP_sha512()
  assert(digest)
  assert(EVP_DigestSignInit(ctx, 0, digest, 0, pk) === 1)
  assert(EVP_DigestUpdate(ctx, plaintext.ptr, plaintext.byteLength) === 1)
  const size = ptr(new Uint32Array(2))
  assert(EVP_DigestSignFinal(ctx, 0, size.ptr) === 1)
  const sig = ptr(new Uint8Array(addr(size)))
  assert(EVP_DigestSignFinal(ctx, sig.ptr, size.ptr) === 1)
  return sig
}

function verify (plaintext, pk, sig) {
  assert(plaintext.ptr && sig.ptr && pk)
  const ctx = EVP_MD_CTX_new()
  assert(ctx)
  const digest = EVP_sha512()
  assert(digest)
  assert(EVP_DigestVerifyInit(ctx, 0, digest, 0, pk) === 1)
  assert(EVP_DigestUpdate(ctx, plaintext.ptr, plaintext.byteLength) === 1)
  assert(EVP_DigestVerifyFinal(ctx, sig.ptr, sig.byteLength) === 1)
  return true
}

const C = cstr('C')
const ST = cstr('ST')
const L = cstr('L')
const O = cstr('O')
const CN = cstr('CN')

const BIO_CTRL_PENDING = 10
const EVP_PKEY_OP_KEYGEN = 1 << 2
const EVP_PKEY_CTRL_RSA_KEYGEN_BITS = 0x1000 + 3
const MBSTRING_ASC = 0x1001

// certificate types
const EVP_PKEY_RSA = 6
const EVP_PKEY_RSA2 = 19

const handle = new Uint32Array(2)
const { libssl } = spin.load('libssl')
for (const name of Object.keys(api)) {
  const def = api[name]
  if (def.result === 'pointer' || def.result === 'u64') {
    libssl[name] = spin.wrap(handle, libssl[name], def.parameters.length)
  }
}

const {
  EVP_PKEY_CTX_new_id, EVP_PKEY_keygen_init, EVP_PKEY_keygen, 
  EVP_PKEY_new, EVP_PKEY_assign, EVP_PKEY_id, EVP_PKEY_type, EVP_PKEY_get1_RSA, 
  EVP_PKEY_CTX_free, EVP_MD_CTX_new, EVP_DigestUpdate, 
  EVP_DigestVerifyFinal, EVP_DigestSignFinal, EVP_sha256, EVP_sha512, 
  EVP_DigestVerifyInit, EVP_DigestSignInit, BIO_s_mem, BIO_new, BIO_new_mem_buf,
  BIO_ctrl, BIO_read, PEM_write_bio_PrivateKey, PEM_write_bio_PUBKEY, 
  PEM_write_bio_X509_REQ, PEM_read_bio_RSA_PUBKEY, PEM_read_bio_RSAPrivateKey, 
  PEM_read_bio_X509, X509_get_subject_name, X509_get_pubkey, X509_NAME_oneline, 
  X509_get_issuer_name, X509_free, X509_REQ_new, X509_REQ_set_version, 
  X509_REQ_get_subject_name, X509_NAME_add_entry_by_txt, X509_REQ_set_pubkey, 
  X509_REQ_sign, RSA_pkey_ctx_ctrl
} = libssl

function test () {
  const start = Date.now()
  // 01. GENERATE RSA KEYPAIR
  // create an RSA keypair and get them back in pem format
  const { pubkey, privkey } = createKeypair()
  const pempub = utf8Decode(privkey.ptr, privkey.byteLength)
  const pempriv = utf8Decode(pubkey.ptr, pubkey.byteLength)
  console.log(`RSA private key as PEM\n${pempub}`)
  console.log(`RSA public key as PEM\n${pempriv}`)
  // 02. SIGNING AND VERIFYING
  // load RSA keys into memory from pem format
  const rsapubkey = loadPublicKey(pubkey)
  const rsaprivkey = loadPrivateKey(privkey)
  // create an empty buffer
  const plaintext = ptr(new Uint8Array(4096))
  // sign the buffer content with the private key
  const sig = sign(plaintext, rsaprivkey)
  assert(sig.byteLength === 256)
  // verify the signature with the public key
  assert(verify(plaintext, rsapubkey, sig))

  // 03. SIGNING AND VERIFYING WITH A LETSENCRYPT CERT AND KEY
  // extract a public key from an x509 cert in pem format
  const certpem = cstr(`-----BEGIN CERTIFICATE-----
MIIFKjCCBBKgAwIBAgISBGnwmKhdv4E4p21hH+rAFX5yMA0GCSqGSIb3DQEBCwUA
MDIxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQswCQYDVQQD
EwJSMzAeFw0yMzAyMTUyMzUyMzlaFw0yMzA1MTYyMzUyMzhaMB0xGzAZBgNVBAMT
EmhvbWUuYmlsbHl3aGl6ei5pbzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBAML8NQh3vMOYj+c6mLxqJ2RwQSQtSsc2gsDanRMZd822nLBxN0QFPPZ7yk5p
PebrEHrBv86gEcsFZCD9tldgQsyMq5BYTvxYExaVa0emMDgjLwxxKwzrZ9JHzdae
Ltp8hLDMeX7MubdzfnRQMCSaPaQPC5cNMBhQK0tyBX8BW7YvOQulxx6wjRB6PA/1
GoBK+nwFE30gFhgpapk5vhAsNUWuoMsMmMpyOBtb4NUI1nHpQYLaqdbE8sGvRlSP
az0sylIBnNu24y/KFRK89TnQr03utXGpmQ3Cw6esA1fRGIdtx0XCagQ1IIY/pTOs
FK3h1FBI1fqrspqbZVLJMyuPRlECAwEAAaOCAk0wggJJMA4GA1UdDwEB/wQEAwIF
oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd
BgNVHQ4EFgQUeQaZFWOFdvNHK+R8E5krL3d8YOowHwYDVR0jBBgwFoAUFC6zF7dY
VsuuUAlA5h+vnYsUwsYwVQYIKwYBBQUHAQEESTBHMCEGCCsGAQUFBzABhhVodHRw
Oi8vcjMuby5sZW5jci5vcmcwIgYIKwYBBQUHMAKGFmh0dHA6Ly9yMy5pLmxlbmNy
Lm9yZy8wHQYDVR0RBBYwFIISaG9tZS5iaWxseXdoaXp6LmlvMEwGA1UdIARFMEMw
CAYGZ4EMAQIBMDcGCysGAQQBgt8TAQEBMCgwJgYIKwYBBQUHAgEWGmh0dHA6Ly9j
cHMubGV0c2VuY3J5cHQub3JnMIIBBAYKKwYBBAHWeQIEAgSB9QSB8gDwAHYAejKM
VNi3LbYg6jjgUh7phBZwMhOFTTvSK8E6V6NS61IAAAGGV7WHGwAABAMARzBFAiBj
mSUXxOuuv/7RYmSgNDvVv+piBOdpgzpKOEw1fbXVDwIhANoDRrloGHs1rUmevqJB
+0gIDMmh7NrYNpb/k0ICx1lHAHYA6D7Q2j71BjUy51covIlryQPTy9ERa+zraeF3
fW0GvW4AAAGGV7WG2wAABAMARzBFAiADLmbg+Ol9Skw2LfxI1+J53XiXlZYe88Ag
D8NdzyxiHgIhALpmpqmEMjvHg7VAtWikTg/cenEhXjuAb7kGeEUeMdE1MA0GCSqG
SIb3DQEBCwUAA4IBAQCdnPRyvcwauU1q/DZ08zqb1WxZQKk4yhMgP6B42V68EY1N
j+MgjPvC88pnJ9orVSWyZXQdnMpyg3NMT8pG9+FwwRRBgCrPQgS0ECuWHpxW5KlC
VyhNxkTc0LQ34BkNbhXr6RWuwDjPDzOQrvQz8p4bdJpFbPdDzQGI9DoyOKmcMyt8
UgP77rErQlwWXPLFp7fJpGEHZKT1o11fTDT8ZdXEVenjs8A9HBS1qNZ0vsn37SO6
c6x9QuAbkzCOu2E1ort9Y0Hbq3WGiW0baymNaZoTFxhHfthNAHU5OfyzkodbzK4K
eTqQQVDw98TVFy47ERUkd2NvUwB0eFiGeCRBQ/CR
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIFFjCCAv6gAwIBAgIRAJErCErPDBinU/bWLiWnX1owDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMjAwOTA0MDAwMDAw
WhcNMjUwOTE1MTYwMDAwWjAyMQswCQYDVQQGEwJVUzEWMBQGA1UEChMNTGV0J3Mg
RW5jcnlwdDELMAkGA1UEAxMCUjMwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
AoIBAQC7AhUozPaglNMPEuyNVZLD+ILxmaZ6QoinXSaqtSu5xUyxr45r+XXIo9cP
R5QUVTVXjJ6oojkZ9YI8QqlObvU7wy7bjcCwXPNZOOftz2nwWgsbvsCUJCWH+jdx
sxPnHKzhm+/b5DtFUkWWqcFTzjTIUu61ru2P3mBw4qVUq7ZtDpelQDRrK9O8Zutm
NHz6a4uPVymZ+DAXXbpyb/uBxa3Shlg9F8fnCbvxK/eG3MHacV3URuPMrSXBiLxg
Z3Vms/EY96Jc5lP/Ooi2R6X/ExjqmAl3P51T+c8B5fWmcBcUr2Ok/5mzk53cU6cG
/kiFHaFpriV1uxPMUgP17VGhi9sVAgMBAAGjggEIMIIBBDAOBgNVHQ8BAf8EBAMC
AYYwHQYDVR0lBBYwFAYIKwYBBQUHAwIGCCsGAQUFBwMBMBIGA1UdEwEB/wQIMAYB
Af8CAQAwHQYDVR0OBBYEFBQusxe3WFbLrlAJQOYfr52LFMLGMB8GA1UdIwQYMBaA
FHm0WeZ7tuXkAXOACIjIGlj26ZtuMDIGCCsGAQUFBwEBBCYwJDAiBggrBgEFBQcw
AoYWaHR0cDovL3gxLmkubGVuY3Iub3JnLzAnBgNVHR8EIDAeMBygGqAYhhZodHRw
Oi8veDEuYy5sZW5jci5vcmcvMCIGA1UdIAQbMBkwCAYGZ4EMAQIBMA0GCysGAQQB
gt8TAQEBMA0GCSqGSIb3DQEBCwUAA4ICAQCFyk5HPqP3hUSFvNVneLKYY611TR6W
PTNlclQtgaDqw+34IL9fzLdwALduO/ZelN7kIJ+m74uyA+eitRY8kc607TkC53wl
ikfmZW4/RvTZ8M6UK+5UzhK8jCdLuMGYL6KvzXGRSgi3yLgjewQtCPkIVz6D2QQz
CkcheAmCJ8MqyJu5zlzyZMjAvnnAT45tRAxekrsu94sQ4egdRCnbWSDtY7kh+BIm
lJNXoB1lBMEKIq4QDUOXoRgffuDghje1WrG9ML+Hbisq/yFOGwXD9RiX8F6sw6W4
avAuvDszue5L3sz85K+EC4Y/wFVDNvZo4TYXao6Z0f+lQKc0t8DQYzk1OXVu8rp2
yJMC6alLbBfODALZvYH7n7do1AZls4I9d1P4jnkDrQoxB3UqQ9hVl3LEKQ73xF1O
yK5GhDDX8oVfGKF5u+decIsH4YaTw7mP3GFxJSqv3+0lUFJoi5Lc5da149p90Ids
hCExroL1+7mryIkXPeFM5TgO9r0rvZaBFOvV2z0gp35Z0+L4WPlbuEjN/lxPFin+
HlUjr8gRsI3qfJOQFy/9rKIJR0Y/8Omwt/8oTWgy1mdeHmmjk7j1nYsvC9JSQ6Zv
MldlTTKB3zhThV1+XWYp6rjd5JW1zbVWEkLNxE7GJThEUG3szgBVGP7pSWTUTsqX
nLRbwHOoq7hHwg==
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
MIIFYDCCBEigAwIBAgIQQAF3ITfU6UK47naqPGQKtzANBgkqhkiG9w0BAQsFADA/
MSQwIgYDVQQKExtEaWdpdGFsIFNpZ25hdHVyZSBUcnVzdCBDby4xFzAVBgNVBAMT
DkRTVCBSb290IENBIFgzMB4XDTIxMDEyMDE5MTQwM1oXDTI0MDkzMDE4MTQwM1ow
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwggIiMA0GCSqGSIb3DQEB
AQUAA4ICDwAwggIKAoICAQCt6CRz9BQ385ueK1coHIe+3LffOJCMbjzmV6B493XC
ov71am72AE8o295ohmxEk7axY/0UEmu/H9LqMZshftEzPLpI9d1537O4/xLxIZpL
wYqGcWlKZmZsj348cL+tKSIG8+TA5oCu4kuPt5l+lAOf00eXfJlII1PoOK5PCm+D
LtFJV4yAdLbaL9A4jXsDcCEbdfIwPPqPrt3aY6vrFk/CjhFLfs8L6P+1dy70sntK
4EwSJQxwjQMpoOFTJOwT2e4ZvxCzSow/iaNhUd6shweU9GNx7C7ib1uYgeGJXDR5
bHbvO5BieebbpJovJsXQEOEO3tkQjhb7t/eo98flAgeYjzYIlefiN5YNNnWe+w5y
sR2bvAP5SQXYgd0FtCrWQemsAXaVCg/Y39W9Eh81LygXbNKYwagJZHduRze6zqxZ
Xmidf3LWicUGQSk+WT7dJvUkyRGnWqNMQB9GoZm1pzpRboY7nn1ypxIFeFntPlF4
FQsDj43QLwWyPntKHEtzBRL8xurgUBN8Q5N0s8p0544fAQjQMNRbcTa0B7rBMDBc
SLeCO5imfWCKoqMpgsy6vYMEG6KDA0Gh1gXxG8K28Kh8hjtGqEgqiNx2mna/H2ql
PRmP6zjzZN7IKw0KKP/32+IVQtQi0Cdd4Xn+GOdwiK1O5tmLOsbdJ1Fu/7xk9TND
TwIDAQABo4IBRjCCAUIwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYw
SwYIKwYBBQUHAQEEPzA9MDsGCCsGAQUFBzAChi9odHRwOi8vYXBwcy5pZGVudHJ1
c3QuY29tL3Jvb3RzL2RzdHJvb3RjYXgzLnA3YzAfBgNVHSMEGDAWgBTEp7Gkeyxx
+tvhS5B1/8QVYIWJEDBUBgNVHSAETTBLMAgGBmeBDAECATA/BgsrBgEEAYLfEwEB
ATAwMC4GCCsGAQUFBwIBFiJodHRwOi8vY3BzLnJvb3QteDEubGV0c2VuY3J5cHQu
b3JnMDwGA1UdHwQ1MDMwMaAvoC2GK2h0dHA6Ly9jcmwuaWRlbnRydXN0LmNvbS9E
U1RST09UQ0FYM0NSTC5jcmwwHQYDVR0OBBYEFHm0WeZ7tuXkAXOACIjIGlj26Ztu
MA0GCSqGSIb3DQEBCwUAA4IBAQAKcwBslm7/DlLQrt2M51oGrS+o44+/yQoDFVDC
5WxCu2+b9LRPwkSICHXM6webFGJueN7sJ7o5XPWioW5WlHAQU7G75K/QosMrAdSW
9MUgNTP52GE24HGNtLi1qoJFlcDyqSMo59ahy2cI2qBDLKobkx/J3vWraV0T9VuG
WCLKTVXkcGdtwlfFRjlBz4pYg1htmf5X6DYO8A4jqv2Il9DjXA6USbW1FzXSLr9O
he8Y4IWS6wY7bCkjCWDcRQJMEhg76fsO3txE+FiYruq9RUWhiF1myv4Q6W+CyBFC
Dfvp7OOGAN6dEOM4+qR9sdjoSYKEBpsr6GtPAQw4dy753ec5
-----END CERTIFICATE-----
`)
  const x509 = loadCertificate(certpem)
  // extracted public key in pem format
  const pubkeycert = extractRSAPublicKey(x509)
  // load the private key from pem
  const privkeycert = cstr(`-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDC/DUId7zDmI/n
Opi8aidkcEEkLUrHNoLA2p0TGXfNtpywcTdEBTz2e8pOaT3m6xB6wb/OoBHLBWQg
/bZXYELMjKuQWE78WBMWlWtHpjA4Iy8McSsM62fSR83Wni7afISwzHl+zLm3c350
UDAkmj2kDwuXDTAYUCtLcgV/AVu2LzkLpccesI0QejwP9RqASvp8BRN9IBYYKWqZ
Ob4QLDVFrqDLDJjKcjgbW+DVCNZx6UGC2qnWxPLBr0ZUj2s9LMpSAZzbtuMvyhUS
vPU50K9N7rVxqZkNwsOnrANX0RiHbcdFwmoENSCGP6UzrBSt4dRQSNX6q7Kam2VS
yTMrj0ZRAgMBAAECggEBALti9Hih0ghL6yg2eSjB//+XnhLtcCsJqRk8P65mUGuj
ruwmsg0t14uuJhu7KqFskNbYssQZs1/gW30VNxK70RaRriO3qpj678VJbeNaxIZ+
0a1saQouhgVhumEifja9aiwbJjwE9gpm9UVE9y+GB+1OBD5zjyAek60a9Es9e+0V
wBtxGefcTJkPQ9YPfV92hr61al9sCPM/qPZykpgNJZoPZweLaR4Gl6I3RD7pjrdY
BgPJT0OHrhSruPdx047RV4LNcfOG302D6BrqZ8ZQ8Ksbs9xnJWidk1IP77ce7ahi
YLRP6hJau+yishukVmrbiRaPb/mSxMk2CVi+7prEPO0CgYEA8sjZbXk4Q0JW6Czp
QIa7moXoLVeps0FBhamKprVj4HyvUaEUHU9MmpQnfOXzWAfcySYOkyONNu2gSNc5
kZvocs+rbujWZOP386BnSkO4Nb+r8/dL0Rt9szsQ+mNJf8XpqyUYEwtRLHrQkqNS
IAAVjm9sJpGSYQYcOqyPeA/5rfMCgYEAzZlIobc7NkDK3+DOLX16CPAE+G7/UQb8
yRCgEX65AlR+dRQiRZIUnVNgorb/XAxuGqyrTKdxXO9ejEDnZRh3Kw3bnvXvKLkK
HzUvVPW167nKfzVgxwQ8PofEqU2Q4ZFUiJN+4jdAChwcyCoNUEs/hDdxnAv67zV+
7sIsKGXL16sCgYBADD5Xw/fUvoaAv4BVNnX9YMAMXij1kgx//2cFbarIiPwTM8RD
qyzRRq5YI62blo9nPTPxGxrg17VGIgkc4Z1j1GcsXh5ZBU7fJXy6Ob056LOrK50D
sBXsF3P2KgU0wPhQ3vtH4t9qNYgadx1uNbd6GOjWD+cm017VF7rNeKFsgwKBgGtT
IAIjJ0q76euSa659eM3flYimUKtYjW7cOeLIFwXrW5P8baOJjS9PTfvCsWy4pGVS
S52ZLulHn0BxxRkV+2dDNak2UqEcbvc5iTq9hTjHZLihAaMCR/yQXQ3QCthlSA5/
iFXIZ6qfYDrxEMAgd8iqNKkz68shTuCOBgUUlqM/AoGAPJLzEegPWWnOf/zx6n2S
xp5Sdlc5x36JHEWGOvLevnJ8IXyA7s3t1/S8n0tfZfBSWcuQ/n79CRsKV4/lTyFe
JfOD0/0Mc3Snxjs6ZnbAjE9WgD110h63RKnmBsT3dKFcb0yyH13Qx64zwA8cf+qn
H++I5A5+51AgJ7Pz4snMu8M=
-----END PRIVATE KEY-----
`)
  //console.log(`RSA private key from cert as PEM\n${dump(privkeycert)}`)
  //console.log(`RSA public key from cert as PEM\n${dump(pubkeycert)}`)
  const rsapubkeycert = loadPublicKey(pubkeycert)
  const rsaprivkeycert = loadPrivateKey(privkeycert)
  // sign the buffer content with the private key
  const sigcert = sign(plaintext, rsaprivkeycert)
  assert(sigcert.byteLength === 256)
  // verify the signature with the public key
  assert(verify(plaintext, rsapubkeycert, sigcert))
  //console.log(`verified signature from cert\n${dump(sigcert)}`)

  // 04. GENERATE A CERTIFICATE SIGNING REQUEST
  const opts = {
    country: 'GB',
    province: 'London',
    city: 'London',
    org: 'billywhizz.io'
  }
  const csr = generateCSR(rsaprivkey, rsapubkey, 'home.billywhizz.io', opts)
  const pemcsr = utf8Decode(csr.ptr, csr.byteLength)
  console.log(`certificate signing request as PEM\n${pemcsr}`)
  console.log(`💩💩💩 ${Date.now() - start} 💩💩💩`)
}

export { test }
