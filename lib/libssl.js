const { libssl } = spin.load('libssl')

const { wrap } = spin

libssl.TLS_client_method = wrap(new Uint32Array(2), libssl.TLS_client_method, 0)
libssl.SSL_CTX_new = wrap(new Uint32Array(2), libssl.SSL_CTX_new, 1)
libssl.SSL_new = wrap(new Uint32Array(2), libssl.SSL_new, 1)

export { libssl }
