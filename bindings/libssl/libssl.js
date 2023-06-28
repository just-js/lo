const api = {
  OpenSSL_version: {
    parameters: ['i32'],
    result: 'pointer',
    rpointer: 'const char*'
  },
  EVP_PKEY_CTX_new_id: {
    parameters: ['i32', 'pointer'],
    pointers: [,'ENGINE*'],
    result: 'pointer',
    rpointer: 'EVP_PKEY_CTX*'
  },
  EVP_PKEY_keygen_init: {
    parameters: ['pointer'], pointers: ['EVP_PKEY_CTX*'],
    result: 'i32'
  },
  EVP_PKEY_keygen: {
    parameters: ['pointer', 'pointer'], 
    pointers: ['EVP_PKEY_CTX*', 'EVP_PKEY**'],
    result: 'i32'
  },
  EVP_PKEY_new: {
    parameters: [],
    result: 'pointer',
    rpointer: 'EVP_PKEY*'
  },
  EVP_PKEY_assign: {
    parameters: ['pointer', 'i32', 'pointer'],
    pointers: ['EVP_PKEY*'],
    result: 'i32'
  },
  EVP_PKEY_id: {
    parameters: ['pointer'],
    pointers: ['EVP_PKEY*'],
    result: 'i32'
  },
  EVP_PKEY_type: {
    parameters: ['i32'],
    result: 'i32'
  },
  EVP_PKEY_get1_RSA: {
    parameters: ['pointer'],
    pointers: ['EVP_PKEY*'],
    result: 'pointer',
    rpointer: 'RSA*'
  },
  EVP_PKEY_free: {
    parameters: ['pointer'], pointers: ['EVP_PKEY*'], result: 'void'
  },
  EVP_PKEY_CTX_free: {
    parameters: ['pointer'], pointers: ['EVP_PKEY_CTX*'], result: 'void'
  },
  EVP_MD_CTX_new: {
    parameters: [],
    result: 'pointer',
    rpointer: 'EVP_MD_CTX*'
  },
  EVP_MD_CTX_reset: {
    parameters: ['pointer'],
    pointers: ['EVP_MD_CTX*'],
    result: 'i32'
  },
  EVP_MD_CTX_free: {
    parameters: ['pointer'],
    pointers: ['EVP_MD_CTX*'],
    result: 'void'
  },
  EVP_get_digestbynid: {
    parameters: ['i32'],
    result: 'pointer',
    rpointer: 'const EVP_MD*'
  },
  EVP_get_digestbyname: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'pointer',
    rpointer: 'const EVP_MD*'
  },
  EVP_Digest: {
    parameters: ['buffer', 'u32', 'buffer', 'buffer', 'pointer', 'pointer'],
    result: 'i32',
    pointers: [,, 'unsigned char*', 'unsigned int*', 'const EVP_MD*', 'ENGINE*']
  },
  EVP_DigestInit_ex: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['EVP_MD_CTX*', 'EVP_MD*', 'ENGINE*'],
    result: 'i32'
  },
  EVP_DigestUpdate: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['EVP_MD_CTX*'],
    result: 'i32',
    name: 'EVP_DigestUpdate'
  },
  EVP_DigestUpdateBuffer: {
    parameters: ['pointer', 'buffer', 'u32'],
    pointers: ['EVP_MD_CTX*'],
    result: 'i32',
    name: 'EVP_DigestUpdate'
  },
  EVP_DigestUpdateString: {
    parameters: ['pointer', 'string', 'u32'],
    pointers: ['EVP_MD_CTX*'],
    result: 'i32',
    name: 'EVP_DigestUpdate'
  },
  EVP_DigestVerifyFinal: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['EVP_MD_CTX*', 'const unsigned char*'],
    result: 'i32'
  },
  EVP_DigestSignFinal: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['EVP_MD_CTX*', 'unsigned char*', 'size_t*'],
    result: 'i32'
  },
  EVP_DigestFinal: {
    parameters: ['pointer', 'buffer', 'u32array'],
    pointers: ['EVP_MD_CTX*', 'unsigned char*', 'unsigned int*'],
    result: 'i32'
  },
  EVP_sha1: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const EVP_MD*'
  },
  EVP_sha224: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const EVP_MD*'
  },
  EVP_sha256: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const EVP_MD*'
  },
  EVP_sha384: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const EVP_MD*'
  },
  EVP_sha512: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const EVP_MD*'
  },
  EVP_sha512_256: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const EVP_MD*'
  },
  EVP_DigestVerifyInit: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer', 'pointer'],
    pointers: ['EVP_MD_CTX*', 'EVP_PKEY_CTX**', 'EVP_MD*', 'ENGINE*', 'EVP_PKEY*'],
    result: 'i32'
  },
  EVP_DigestSignInit: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer', 'pointer'],
    pointers: ['EVP_MD_CTX*', 'EVP_PKEY_CTX**', 'EVP_MD*', 'ENGINE*', 'EVP_PKEY*'],
    result: 'i32'
  },
  BIO_s_mem: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const BIO_METHOD*'
  },
  BIO_new: {
    parameters: ['pointer'],
    pointers: ['BIO_METHOD*'],
    rpointer: 'BIO *',
    result: 'pointer'
  },
  BIO_new_mem_buf: {
    parameters: ['pointer', 'i32'],
    result: 'pointer',
    rpointer: 'BIO*',
    pointers: ['const void*']
  },
  BIO_ctrl: {
    parameters: ['pointer', 'i32', 'u64', 'pointer'],
    pointers: ['BIO*'],
    result: 'i32'
  },
  BIO_read: {
    parameters: ['pointer', 'pointer', 'i32'],
    pointers: ['BIO*'],
    result: 'i32'
  },
  PEM_write_bio_PrivateKey: {
    parameters: [
      'pointer', 'pointer', 'pointer', 'pointer', 'i32', 'pointer', 'pointer'
    ],
    pointers: ['BIO*', 'EVP_PKEY*', 'EVP_CIPHER*', 'unsigned char*', , 'pem_password_cb*'],
    result: 'i32'
  },
  PEM_write_bio_PUBKEY: {
    parameters: ['pointer', 'pointer'],
    pointers: ['BIO*', 'EVP_PKEY*'],
    result: 'i32'
  },
  PEM_write_bio_X509_REQ: {
    parameters: ['pointer', 'pointer'],
    pointers: ['BIO*', 'X509_REQ*'],
    result: 'i32'
  },
  PEM_read_bio_RSA_PUBKEY: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer'],
    result: 'pointer',
    rpointer: 'RSA*',
    pointers: ['BIO*', 'RSA**', 'pem_password_cb*']
  },
  PEM_read_bio_RSAPrivateKey: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer'],
    result: 'pointer',
    rpointer: 'RSA*',
    pointers: ['BIO*', 'RSA**', 'pem_password_cb*']
  },
  PEM_read_bio_X509: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer'],
    result: 'pointer',
    rpointer: 'X509*',
    pointers: ['BIO*', 'X509**', 'pem_password_cb*']
  },
  X509_get_subject_name: {
    parameters: ['pointer'],
    pointers: ['const X509*'],
    result: 'pointer',
    rpointer: 'X509_NAME*'
  },
  X509_NAME_oneline: {
    parameters: ['pointer', 'pointer', 'i32'],
    pointers: ['const X509_NAME*', 'char*'],
    result: 'pointer',
    rpointer: 'char*'
  },
  X509_get_issuer_name: {
    parameters: ['pointer'],
    pointers: ['const X509*'],
    result: 'pointer',
    rpointer: 'X509_NAME*'
  },
  X509_free: {
    parameters: ['pointer'],
    pointers: ['X509*'],
    result: 'void'
  },
  X509_get_pubkey: {
    parameters: ['pointer'],
    pointers: ['X509*'],
    result: 'pointer',
    rpointer: 'EVP_PKEY*'
  },
  X509_REQ_new: {
    parameters: [],
    result: 'pointer',
    rpointer: 'X509_REQ*'
  },
  X509_REQ_set_version: {
    parameters: ['pointer', 'u32'],
    pointers: ['X509_REQ*'],
    result: 'i32'
  },
  X509_REQ_get_subject_name: {
    parameters: ['pointer'],
    pointers: ['X509_REQ*'],
    result: 'pointer',
    rpointer: 'X509_NAME*'
  },
  X509_NAME_add_entry_by_txt: {
    parameters: ['pointer', 'pointer', 'i32', 'pointer', 'i32', 'i32', 'i32'],
    pointers: ['X509_NAME*', 'const char*', , 'const unsigned char*'],
    result: 'i32'
  },
  X509_REQ_set_pubkey: {
    parameters: ['pointer', 'pointer'],
    pointers: ['X509_REQ*', 'EVP_PKEY*'],
    result: 'i32'
  },
  X509_REQ_sign: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['X509_REQ*', 'EVP_PKEY*', 'const EVP_MD*'],
    result: 'i32'
  },
  OBJ_txt2nid: {
    parameters: ['pointer'],
    pointers: ['const char*'],
    result: 'i32'
  },
  SSL_get_error: {
    parameters: ['pointer', 'i32'],
    pointers: ['const SSL*'],
    result: 'i32'
  },
  SSL_is_init_finished: {
    parameters: ['pointer'],
    pointers: ['const SSL*'],
    result: 'i32'
  },
  SSL_shutdown: {
    parameters: ['pointer'],
    pointers: ['SSL*'],
    result: 'i32'
  },
  SSL_get_servername: {
    parameters: ['pointer', 'i32'],
    pointers: ['const SSL*'],
    rpointer: 'const char*',
    result: 'pointer'
  },
  SSL_get_servername_type: {
    parameters: ['pointer'],
    pointers: ['const SSL*'],
    result: 'i32'
  },
  SSL_free: {
    parameters: ['pointer'],
    pointers: ['SSL*'],
    result: 'void'
  },
  SSL_read: {
    parameters: ['pointer', 'pointer', 'i32'],
    pointers: ['SSL*'],
    result: 'i32'
  },
  SSL_write: {
    parameters: ['pointer', 'pointer', 'i32'],
    pointers: ['SSL*'],
    result: 'i32'
  },
  SSL_get_version: {
    parameters: ['pointer'],
    pointers: ['const SSL*'],
    result: 'pointer',
    rpointer: 'const char*'
  },
  SSL_CIPHER_get_name: {
    parameters: ['pointer'],
    pointers: ['const SSL_CIPHER*'],
    result: 'pointer',
    rpointer: 'const char*'
  },
  SSL_get_current_cipher: {
    parameters: ['pointer'],
    pointers: ['const SSL*'],
    result: 'pointer',
    rpointer: 'const SSL_CIPHER*'
  },
  SSL_get_peer_certificate: {
    parameters: ['pointer'],
    pointers: ['const SSL*'],
    result: 'pointer',
    rpointer: 'X509*'
  },
  SSL_set_SSL_CTX: {
    parameters: ['pointer', 'pointer'],
    result: 'pointer',
    rpointer: 'SSL_CTX*',
    pointers: ['SSL*', 'SSL_CTX*']
  },
  SSL_new: {
    parameters: ['pointer'],
    result: 'pointer',
    rpointer: 'SSL*',
    pointers: ['SSL_CTX*']
  },
  SSL_set_fd: {
    parameters: ['pointer', 'i32'],
    pointers: ['SSL*'],
    result: 'i32'
  },
  SSL_set_bio: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['SSL*', 'BIO*', 'BIO*'],
    result: 'void'
  },
  SSL_set_accept_state: {
    parameters: ['pointer'],
    pointers: ['SSL*'],
    result: 'void'
  },
  SSL_accept: {
    parameters: ['pointer'],
    pointers: ['SSL*'],
    result: 'i32'
  },
  SSL_set_connect_state: {
    parameters: ['pointer'],
    pointers: ['SSL*'],
    result: 'void'
  },
  SSL_do_handshake: {
    parameters: ['pointer'],
    pointers: ['SSL*'],
    result: 'i32'
  },
  SSL_CTX_new: {
    parameters: ['pointer'],
    result: 'pointer',
    rpointer: 'SSL_CTX*',
    pointers: ['SSL_METHOD*']
  },
  SSL_CTX_use_certificate_file: {
    parameters: ['pointer', 'pointer', 'i32'],
    pointers: ['SSL_CTX*', 'const char*'],
    result: 'i32'
  },
  SSL_CTX_use_certificate_chain_file: {
    parameters: ['pointer', 'pointer'],
    pointers: ['SSL_CTX*', 'const char*'],
    result: 'i32'
  },
  SSL_CTX_use_PrivateKey_file: {
    parameters: ['pointer', 'pointer', 'i32'],
    pointers: ['SSL_CTX*', 'const char*'],
    result: 'i32'
  },
  SSL_CTX_set_options: {
    parameters: ['pointer', 'u64'],
    pointers: ['SSL_CTX*'],
    result: 'u64'
  },
  SSL_CTX_set_cipher_list: {
    parameters: ['pointer', 'pointer'],
    pointers: ['SSL_CTX*', 'const char*'],
    result: 'i32'
  },
  SSL_set_cipher_list: {
    parameters: ['pointer', 'pointer'],
    pointers: ['SSL*', 'const char*'],
    result: 'i32'
  },
  SSL_CTX_free: {
    parameters: ['pointer'],
    pointers: ['SSL_CTX*'],
    result: 'void'
  },
  TLS_server_method: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const SSL_METHOD*'
  },
  TLS_client_method: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const SSL_METHOD*'
  },
  SSL_CTX_set_ciphersuites: {
    parameters: ['pointer', 'pointer'],
    pointers: ['SSL_CTX*', 'const char*'],
    result: 'i32'
  },
  SSL_ctrl: {
    parameters: ['pointer', 'i32', 'u64', 'pointer'],
    pointers: ['SSL*'],
    result: 'u64'
  },
  RSA_pkey_ctx_ctrl: {
    parameters: ['pointer', 'i32', 'i32', 'i32', 'pointer'], 
    pointers: ['EVP_PKEY_CTX*'],
    result: 'i32'
  },
  EVP_sha512_224: {
    parameters: [],
    result: 'pointer',
    rpointer: 'const EVP_MD*'
  }
}

const name = 'libssl'

const includes = [
  'openssl/opensslv.h',
  'openssl/err.h',
  'openssl/dh.h',
  'openssl/ssl.h',
  'openssl/conf.h',
  'openssl/engine.h',
  'openssl/hmac.h',
  'openssl/evp.h',
  'openssl/rsa.h',
  'openssl/pem.h',
  'atomic'
]

const libs = []
const obj = ['libssl_o.a', 'libcrypto.a']
const make = `
deps:
	mkdir -p deps
	curl -L -o openssl-1.1.1t.tar.gz https://www.openssl.org/source/openssl-1.1.1t.tar.gz
	tar -zxvf openssl-1.1.1t.tar.gz -C deps
	rm openssl-1.1.1t.tar.gz

libcrypto.a libssl_o.a: deps
	cd deps/openssl-1.1.1t/ &&	CFLAGS='-fPIC -mtune=native -m64 -O3' ./config shared zlib no-ssl no-tls1 no-dtls no-aria no-bf no-blake2 no-camellia no-cast no-chacha no-cmac no-des no-idea no-mdc2 no-ocb no-poly1305 no-rc2 no-scrypt no-seed no-siphash no-sm3 no-sm4 no-whirlpool no-afalgeng no-deprecated no-capieng no-cms no-comp no-dgram no-threads && make clean build_generated && make -j 6
	cp deps/openssl-1.1.1t/libssl.a ./libssl_o.a
	cp deps/openssl-1.1.1t/libcrypto.a ./
`

export { api, name, includes, libs, obj, make }
