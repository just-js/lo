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
  client_config_builder_load_roots_from_file: {
    parameters: ['pointer', 'string'],
    pointers: ['struct rustls_client_config_builder *', 'const char*'],
    result: 'i32',
    name: 'rustls_client_config_builder_load_roots_from_file'
  },
  client_config_builder_set_alpn_protocols: {
    parameters: ['pointer', 'buffer', 'u32'],
    pointers: ['struct rustls_client_config_builder *', 'const struct rustls_slice_bytes *'],
    result: 'i32',
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
    parameters: ['pointer', 'string', 'u32array'],
    pointers: ['const struct rustls_client_config *', 'const char*', 'struct rustls_connection **'],
    result: 'i32',
    name: 'rustls_client_connection_new'
  },
  connection_wants_read: {
    parameters: ['pointer'],
    pointers: ['struct rustls_connection *'],
    result: 'i32',
    name: 'rustls_connection_wants_read'
  },
  connection_read_tls: {
    parameters: ['pointer', 'pointer', 'u32array', 'u32array'],
    pointers: ['struct rustls_connection *', 'rustls_read_callback', , 'size_t*'],
    result: 'i32',
    name: 'rustls_connection_read_tls'
  },
  connection_read: {
    parameters: ['pointer', 'buffer', 'u32', 'u32array'],
    pointers: ['struct rustls_connection *', 'uint8_t*', , 'size_t*'],
    result: 'i32',
    name: 'rustls_connection_read'
  },
  connection_wants_write: {
    parameters: ['pointer'],
    pointers: ['struct rustls_connection *'],
    result: 'i32',
    name: 'rustls_connection_wants_write'
  },
  connection_write_tls: {
    parameters: ['pointer', 'pointer', 'u32array', 'u32array'],
    pointers: ['struct rustls_connection *', 'rustls_write_callback', , 'size_t*'],
    result: 'i32',
    name: 'rustls_connection_write_tls'
  },
  connection_write: {
    parameters: ['pointer', 'buffer', 'u32', 'u32array'],
    pointers: ['struct rustls_connection *', 'const uint8_t*', , 'size_t*'],
    result: 'i32',
    name: 'rustls_connection_write'
  },
  connection_process_new_packets: {
    parameters: ['pointer'],
    pointers: ['struct rustls_connection *'],
    result: 'i32',
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

const includes = ['rustls.h']
const obj = ['librustls_ffi.a']

const make = `
librustls_ffi.a: ## dependencies
	mkdir -p deps
	curl -L -o deps/rustls-ffi.tar.gz "https://codeload.github.com/rustls/rustls-ffi/tar.gz/v0.10.0"
	tar -zxvf deps/rustls-ffi.tar.gz -C deps/
	cd deps/rustls-ffi-0.10.0/ && cargo build --release && cd ../../
	cp deps/rustls-ffi-0.10.0/src/rustls.h ./
	cp deps/rustls-ffi-0.10.0/target/release/librustls_ffi.a ./
`

export { name, api, includes, make, obj }
