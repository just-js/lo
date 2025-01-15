const api = {
  version: {
    parameters: [],
    result: 'pointer',
    rpointer: 'rustls_str',
    name: 'rustls_version'
  },
  client_config_builder_new: {
    parameters: [],
    result: 'pointer',
    rpointer: 'struct rustls_client_config_builder*',
    name: 'rustls_client_config_builder_new'
  },
  connection_set_log_callback: {
    parameters: ['pointer', 'pointer'],
    pointers: ['struct rustls_connection *', 'rustls_log_callback'],
    result: 'void',
    name: 'rustls_connection_set_log_callback'
  },
  connection_set_userdata: {
    parameters: ['pointer', 'pointer'],
    pointers: ['struct rustls_connection *'],
    result: 'void',
    name: 'rustls_connection_set_userdata'
  },
  client_config_builder_dangerous_set_certificate_verifier: {
    parameters: ['pointer', 'pointer'],
    pointers: ['struct rustls_client_config_builder*', 'rustls_verify_server_cert_callback'],
    result: 'u32',
    name: 'rustls_client_config_builder_dangerous_set_certificate_verifier'
  },
  root_cert_store_builder_new: {
    parameters: [],
    result: 'pointer',
    rpointer: 'rustls_root_cert_store_builder*',
    name: 'rustls_root_cert_store_builder_new'
  },
  root_cert_store_builder_load_roots_from_file: {
    parameters: ['pointer', 'string', 'bool'],
    pointers: ['rustls_root_cert_store_builder*'],
    result: 'u32',
    name: 'rustls_root_cert_store_builder_load_roots_from_file'
  },
  root_cert_store_builder_load_roots_from_bytes: {
    parameters: ['pointer', 'buffer', 'u32', 'bool'],
    pointers: ['rustls_root_cert_store_builder*', 'uint8_t *'],
    result: 'u32',
    name: 'rustls_root_cert_store_builder_load_roots_from_bytes'
  },
  root_cert_store_builder_build: {
    parameters: ['pointer', 'pointer'],
    pointers: ['rustls_root_cert_store_builder*', 'const struct rustls_root_cert_store **'],
    result: 'u32',
    name: 'rustls_root_cert_store_builder_build'
  },
  web_pki_server_cert_verifier_builder_new: {
    parameters: ['pointer'],
    pointers: ['const struct rustls_root_cert_store *'],
    result: 'pointer',
    rpointer: 'struct rustls_web_pki_server_cert_verifier_builder *',
    name: 'rustls_web_pki_server_cert_verifier_builder_new'
  },
  web_pki_server_cert_verifier_builder_build: {
    parameters: ['pointer', 'pointer'],
    pointers: ['rustls_web_pki_server_cert_verifier_builder*', 'struct rustls_server_cert_verifier **'],
    result: 'u32',
    name: 'rustls_web_pki_server_cert_verifier_builder_build'
  },
  client_config_builder_set_server_verifier: {
    parameters: ['pointer', 'pointer'],
    pointers: ['struct rustls_client_config_builder*', 'const struct rustls_server_cert_verifier *'],
    result: 'void',
    name: 'rustls_client_config_builder_set_server_verifier'
  },
  client_config_builder_set_enable_sni: {
    parameters: ['pointer', 'bool'],
    pointers: ['struct rustls_client_config_builder *'],
    result: 'void',
    name: 'rustls_client_config_builder_set_enable_sni'
  },
  client_config_builder_set_alpn_protocols: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['struct rustls_client_config_builder *', 'const struct rustls_slice_bytes *'],
    result: 'u32',
    name: 'rustls_client_config_builder_set_alpn_protocols'
  },
  client_config_builder_build: {
    parameters: ['pointer'],
    pointers: ['struct rustls_client_config_builder *'],
    result: 'pointer',
    rpointer: 'const struct rustls_client_config *',
    name: 'rustls_client_config_builder_build'
  },
  client_config_free: {
    parameters: ['pointer'],
    pointers: ['const struct rustls_client_config *'],
    result: 'void',
    name: 'rustls_client_config_free'
  },
  client_connection_new: {
    parameters: ['pointer', 'pointer', 'u32array'],
    pointers: ['const struct rustls_client_config *', 'const char*', 'struct rustls_connection **'],
    result: 'u32',
    name: 'rustls_client_connection_new'
  },
  connection_wants_read: {
    parameters: ['pointer'],
    pointers: ['struct rustls_connection *'],
    result: 'u32',
    name: 'rustls_connection_wants_read'
  },
  connection_read_tls: {
    parameters: ['pointer', 'pointer', 'buffer', 'u32array'],
    pointers: ['struct rustls_connection *', 'rustls_read_callback', , 'size_t*'],
    result: 'u32',
    name: 'rustls_connection_read_tls'
  },
  connection_read_tls_from_fd: {
    parameters: ['pointer', 'i32', 'u32array'],
    pointers: ['struct rustls_connection *', , 'size_t*'],
    result: 'u32',
    name: 'rustls_connection_read_tls_from_fd'
  },
  connection_read: {
    parameters: ['pointer', 'buffer', 'u32', 'u32array'],
    pointers: ['struct rustls_connection *', 'uint8_t*', , 'size_t*'],
    result: 'u32',
    name: 'rustls_connection_read'
  },
  connection_wants_write: {
    parameters: ['pointer'],
    pointers: ['struct rustls_connection *'],
    result: 'u32',
    name: 'rustls_connection_wants_write'
  },
  connection_write_tls: {
    parameters: ['pointer', 'pointer', 'buffer', 'u32array'],
    pointers: ['struct rustls_connection *', 'rustls_write_callback', , 'size_t*'],
    result: 'u32',
    name: 'rustls_connection_write_tls'
  },
  connection_write_tls_to_fd: {
    parameters: ['pointer', 'i32', 'u32array'],
    pointers: ['struct rustls_connection *', , 'size_t*'],
    result: 'u32',
    name: 'rustls_connection_write_tls_to_fd'
  },
  connection_write: {
    parameters: ['pointer', 'buffer', 'u32', 'u32array'],
    pointers: ['struct rustls_connection *', 'const uint8_t*', , 'size_t*'],
    result: 'u32',
    name: 'rustls_connection_write'
  },
  connection_process_new_packets: {
    parameters: ['pointer'],
    pointers: ['struct rustls_connection *'],
    result: 'u32',
    name: 'rustls_connection_process_new_packets'
  },
  connection_free: {
    parameters: ['pointer'],
    pointers: ['struct rustls_connection *'],
    result: 'void',
    name: 'rustls_connection_free'
  }
}

const name = 'rustls'

//const includes = ['rustls.h']
const includes = []

const preamble = `
#ifdef __cplusplus
extern "C"
    {
#endif
#include <rustls.h>
#ifdef __cplusplus
    }
#endif
`

const obj = ['librustls_ffi.a']

export { name, api, includes, obj, preamble }
