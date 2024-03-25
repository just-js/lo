import { api } from 'lib/libssl/api.js'

let libssl
if (lo.getenv('LOSSL') === 'boringssl') {
  libssl = lo.load('boringssl').boringssl
} else {
  libssl = lo.load('libssl').libssl
}

const { wrap } = lo
const {
  SSL_OP_ALL, SSL_OP_NO_RENEGOTIATION, SSL_OP_NO_SSLv3, SSL_OP_NO_TLSv1, 
  SSL_OP_NO_TLSv1_1, SSL_OP_NO_DTLSv1, SSL_OP_NO_DTLSv1_2, SSL_OP_NO_COMPRESSION
} = libssl

const handle = new Uint32Array(2)

for (const name of Object.keys(api)) {
  const def = api[name]
  if (!libssl[name]) continue
  if (def.result === 'pointer' || def.result === 'u64') {
    libssl[name] = wrap(handle, libssl[name], def.parameters.length)
  }
}

libssl.default_options = SSL_OP_ALL | SSL_OP_NO_RENEGOTIATION | SSL_OP_NO_SSLv3 | 
  SSL_OP_NO_TLSv1 | SSL_OP_NO_TLSv1_1 | SSL_OP_NO_DTLSv1 | SSL_OP_NO_DTLSv1_2 |
  SSL_OP_NO_COMPRESSION

export { libssl }
