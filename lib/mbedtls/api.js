const api = {
  mbedtls_x509_crt_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_x509_crt*'],
    result: 'void'
  },
  mbedtls_net_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_net_context*'],
    result: 'void'
  },
  mbedtls_ssl_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_context*'],
    result: 'void'
  },
  mbedtls_ssl_config_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_ssl_config*'],
    result: 'void'
  },
  mbedtls_entropy_init: {
    parameters: ['pointer'],
    pointers: ['mbedtls_entropy_context*'],
    result: 'void'
  },
  mbedtls_x509_crt_parse_der: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['mbedtls_x509_crt*', 'const unsigned char*'],
    result: 'i32'
  }
}

const includes = ['mbedtls/x509.h', 'mbedtls/entropy.h', 'mbedtls/ssl.h', 'mbedtls/net_sockets.h']
const include_paths = ['./deps/mbedtls/include']
const name = 'mbedtls'
const libs = []
const obj = [
  'deps/mbedtls/library/libmbedx509.a', 'deps/mbedtls/library/libmbedcrypto.a', 'deps/mbedtls/library/libmbedtls.a'
]
const structs = [
  'mbedtls_net_context', 'mbedtls_x509_crt', 'mbedtls_entropy_context', 'mbedtls_ssl_context', 'mbedtls_ssl_config'
]

/*
todo: add build function

	mkdir -p deps/mbedtls
	curl -L -o deps/mbedtls/v3.5.1.tar.gz https://github.com/Mbed-TLS/mbedtls/archive/refs/tags/v3.5.1.tar.gz
	tar -zxvf deps/mbedtls/v3.5.1.tar.gz -C deps/mbedtls


*/
export { name, api, libs, obj, includes, include_paths, structs }
