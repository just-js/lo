const api = {
  x509_crt_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_x509_crt*'],
    result: 'void',
    name: 'mbedtls_x509_crt_init'
  },
  net_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_net_context*'],
    result: 'void',
    name: 'mbedtls_net_init'
  },
  ssl_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_context*'],
    result: 'void',
    name: 'mbedtls_ssl_init'
  },
  ssl_config_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'void',
    name: 'mbedtls_ssl_config_init'
  },
  entropy_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_entropy_context*'],
    result: 'void',
    name: 'mbedtls_entropy_init'
  },
  ctr_drbg_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ctr_drbg_context*'],
    result: 'void',
    name: 'mbedtls_ctr_drbg_init'
  },
  x509_crt_parse_der: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['mbedtls_x509_crt*', 'const unsigned char*'],
    result: 'i32',
    name: 'mbedtls_x509_crt_parse_der'
  },
  debug_set_threshold: {
    parameters: ['i32'],
    result: 'void',
    name: 'mbedtls_debug_set_threshold'
  },
  ctr_drbg_seed: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer', 'u32'],
    pointers: ['mbedtls_ctr_drbg_context*', 'mbedtls_entropy_callback', , 'const unsigned char*'],
    result: 'i32',
    name: 'mbedtls_ctr_drbg_seed'
  },
  exit: {
    parameters: ['i32'],
    result: 'void',
    name: 'mbedtls_exit'
  },
  x509_crt_parse: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['mbedtls_x509_crt*', 'const unsigned char*'],
    result: 'i32',
    name: 'mbedtls_x509_crt_parse'
  },
  ssl_config_defaults: {
    parameters: ['pointer', 'i32', 'i32', 'i32'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'i32',
    name: 'mbedtls_ssl_config_defaults'
  },
  ssl_conf_max_frag_len: {
    parameters: ['pointer', 'u8'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'i32',
    name: 'mbedtls_ssl_conf_max_frag_len'
  },
  ssl_conf_rng: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['mbedtls_ssl_config*', 'mbedtls_rng_callback'],
    result: 'void',
    name: 'mbedtls_ssl_conf_rng'
  },
  ssl_conf_dbg: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['mbedtls_ssl_config*', 'mbedtls_dbg_callback'],
    result: 'void',
    name: 'mbedtls_ssl_conf_dbg'
  },
  ssl_conf_read_timeout: {
    parameters: ['pointer', 'u32'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'void',
    name: 'mbedtls_ssl_conf_read_timeout'
  },
  ssl_conf_session_tickets: {
    parameters: ['pointer', 'i32'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'void',
    name: 'mbedtls_ssl_conf_session_tickets'
  },
/*
  ssl_conf_tls13_key_exchange_modes: {
    parameters: ['pointer', 'i32'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'void',
    name: 'mbedtls_ssl_conf_tls13_key_exchange_modes'
  },
*/
  ssl_conf_renegotiation: {
    parameters: ['pointer', 'i32'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'void',
    name: 'mbedtls_ssl_conf_renegotiation'
  },
  ssl_conf_ca_chain: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['mbedtls_ssl_config*', 'mbedtls_x509_crt*', 'mbedtls_x509_crl*'],
    result: 'void',
    name: 'mbedtls_ssl_conf_ca_chain'
  },
  ssl_conf_min_version: {
    parameters: ['pointer', 'i32', 'i32'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'void',
    name: 'mbedtls_ssl_conf_min_version'
  },
  ssl_conf_max_version: {
    parameters: ['pointer', 'i32', 'i32'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'void',
    name: 'mbedtls_ssl_conf_max_version'
  },
  ssl_setup: {
    parameters: ['pointer', 'pointer'],
    pointers: ['mbedtls_ssl_context*', 'mbedtls_ssl_config*'],
    result: 'i32',
    name: 'mbedtls_ssl_setup'
  },
  ssl_set_hostname: {
    parameters: ['pointer', 'string'],
    pointers: ['mbedtls_ssl_context*'],
    result: 'i32',
    name: 'mbedtls_ssl_set_hostname'
  },
  ssl_set_bio: {
    parameters: ['pointer', 'pointer', 'pointer', 'pointer', 'pointer'],
    pointers: ['mbedtls_ssl_context*', , 'mbedtls_ssl_send_t*', 'mbedtls_ssl_recv_t*', 'mbedtls_ssl_recv_timeout_t*'],
    result: 'void',
    name: 'mbedtls_ssl_set_bio'
  },
  net_connect: {
    parameters: ['pointer', 'string', 'string', 'i32'],
    pointers: ['mbedtls_net_context*'],
    result: 'i32',
    name: 'mbedtls_net_connect'
  },
  net_set_block: {
    parameters: ['pointer'],
    pointers: ['mbedtls_net_context*'],
    result: 'i32',
    name: 'mbedtls_net_set_block'
  },
  ssl_handshake: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_context*'],
    result: 'i32',
    name: 'mbedtls_ssl_handshake'
  },
  ssl_get_version: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_context*'],
    result: 'pointer',
    rpointer: 'const char*',
    name: 'mbedtls_ssl_get_version'
  },
  ssl_get_ciphersuite: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_context*'],
    result: 'pointer',
    rpointer: 'const char*',
    name: 'mbedtls_ssl_get_ciphersuite'
  },
  ssl_get_verify_result: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_context*'],
    result: 'u32',
    name: 'mbedtls_ssl_get_verify_result'
  },
  ssl_write: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['mbedtls_ssl_context*', 'const unsigned char*'],
    result: 'i32',
    name: 'mbedtls_ssl_write'
  },
  ssl_read: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['mbedtls_ssl_context*', 'unsigned char*'],
    result: 'i32',
    name: 'mbedtls_ssl_read'
  },
  ssl_close_notify: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_context*'],
    result: 'i32',
    name: 'mbedtls_ssl_close_notify'
  },
  net_free: {
    parameters: ['pointer'],
    pointers: ['mbedtls_net_context*'],
    result: 'void',
    name: 'mbedtls_net_free'
  },
  ssl_free: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_context*'],
    result: 'void',
    name: 'mbedtls_ssl_free'
  },
  ssl_config_free: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'void',
    name: 'mbedtls_ssl_config_free'
  },
  x509_crt_free: {
    parameters: ['pointer'],
    pointers: ['mbedtls_x509_crt*'],
    result: 'void',
    name: 'mbedtls_x509_crt_free'
  },
  ctr_drbg_free: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ctr_drbg_context*'],
    result: 'void',
    name: 'mbedtls_ctr_drbg_free'
  },
  entropy_free: {
    parameters: ['pointer'],
    pointers: ['mbedtls_entropy_context*'],
    result: 'void',
    name: 'mbedtls_entropy_free'
  },
  dhm_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_dhm_context*'],
    result: 'void',
    name: 'mbedtls_dhm_init'
  },
  md5_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_md5_context *'],
    result: 'void',
    name: 'mbedtls_md5_init'
  },
  md5_free: {
    parameters: ['pointer'],
    pointers: ['mbedtls_md5_context *'],
    result: 'void',
    name: 'mbedtls_md5_free'
  },
  md5_starts: {
    parameters: ['pointer'],
    pointers: ['mbedtls_md5_context *'],
    result: 'void',
    name: 'mbedtls_md5_starts'
  },
  md5_update: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['mbedtls_md5_context *', 'const unsigned char*'],
    result: 'void',
    name: 'mbedtls_md5_update'
  },
  md5_finish: {
    parameters: ['pointer', 'pointer'],
    pointers: ['mbedtls_md5_context *', 'unsigned char*'],
    result: 'void',
    name: 'mbedtls_md5_finish'
  },
  md5_update_string: {
    parameters: ['pointer', 'string', 'u32'],
    pointers: ['mbedtls_md5_context *'],
    casts: [, '(const unsigned char*)'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }],
    result: 'void',
    name: 'mbedtls_md5_update'
  },
  sha256_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_sha256_context *'],
    result: 'void',
    name: 'mbedtls_sha256_init'
  },
  sha256_free: {
    parameters: ['pointer'],
    pointers: ['mbedtls_sha256_context *'],
    result: 'void',
    name: 'mbedtls_sha256_free'
  },
  sha256_starts: {
    parameters: ['pointer', 'i32'],
    pointers: ['mbedtls_sha256_context *'],
    result: 'void',
    name: 'mbedtls_sha256_starts'
  },
  sha256_update: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['mbedtls_sha256_context *', 'const unsigned char*'],
    result: 'void',
    name: 'mbedtls_sha256_update'
  },
  sha256_update_string: {
    parameters: ['pointer', 'string', 'u32'],
    pointers: ['mbedtls_sha256_context *'],
    casts: [, '(const unsigned char*)'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }],
    result: 'void',
    name: 'mbedtls_sha256_update'
  },
  sha256_finish: {
    parameters: ['pointer', 'pointer'],
    pointers: ['mbedtls_sha256_context *', 'unsigned char*'],
    result: 'void',
    name: 'mbedtls_sha256_finish'
  },
}

const includes = [
  'mbedtls/x509.h', 'mbedtls/entropy.h', 'mbedtls/ssl.h',
  'mbedtls/net_sockets.h',
  'mbedtls/ctr_drbg.h', 'mbedtls/debug.h',
  'mbedtls/platform.h'
]
const include_paths = ['./deps/mbedtls/include']
const name = 'mbedtls'
const libs = []
const obj = [
  'deps/mbedtls/library/libmbedx509.a', 'deps/mbedtls/library/libmbedcrypto.a',
  'deps/mbedtls/library/libmbedtls.a'
]
const structs = [
  'mbedtls_net_context', 'mbedtls_x509_crt', 'mbedtls_entropy_context',
  'mbedtls_ssl_context', 'mbedtls_ssl_config', 'mbedtls_ctr_drbg_context',
  'mbedtls_dhm_context', 'mbedtls_md5_context', 'mbedtls_sha256_context'
]
const preamble = `
typedef int (*mbedtls_entropy_callback)(void *, unsigned char *, size_t);
typedef int (*mbedtls_rng_callback)(void *, unsigned char *, size_t);
typedef void (*mbedtls_dbg_callback)(void *, int, const char *, int, const char *);
`
const constants = {
  MBEDTLS_SSL_IS_CLIENT: 'i32',
  MBEDTLS_SSL_TRANSPORT_STREAM: 'i32',
  MBEDTLS_SSL_PRESET_DEFAULT: 'i32',
  MBEDTLS_SSL_MAX_FRAG_LEN_NONE: 'i32',
  MBEDTLS_SSL_SESSION_TICKETS_ENABLED: 'i32',
  MBEDTLS_SSL_TLS1_3_KEY_EXCHANGE_MODE_ALL: 'i32',
  MBEDTLS_SSL_RENEGOTIATION_DISABLED: 'i32',
  MBEDTLS_SSL_MAJOR_VERSION_3: 'i32',
  MBEDTLS_SSL_MINOR_VERSION_4: 'i32',
  MBEDTLS_NET_PROTO_TCP: 'i32',
  MBEDTLS_ERR_SSL_WANT_READ: 'i32',
  MBEDTLS_ERR_SSL_WANT_WRITE: 'i32',
  MBEDTLS_ERR_SSL_CRYPTO_IN_PROGRESS: 'i32',
  MBEDTLS_ERR_SSL_PEER_CLOSE_NOTIFY: 'i32'
}

export {
  name, api, libs, obj, includes, include_paths, structs, preamble, constants
}
