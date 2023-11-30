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

import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec } from 'lib/proc.js'

async function build (C = 'gcc', CC = 'g++') {
  const { assert } = lo
  const { chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile } = lo.core
  if (!isDir('deps/mbedtls')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('v3.5.1.tar.gz')) {
      console.log('fetching release')
      fetch('https://github.com/Mbed-TLS/mbedtls/archive/refs/tags/v3.5.1.tar.gz', 'v3.5.1.tar.gz')
    }
    const bytes = readFile('v3.5.1.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/mbedtls`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    assert(chdir('deps/mbedtls') === 0)
    const status = new Int32Array(2)
    // this fixes an issue using g++ to compile C code as CC should really be the C compiler, not the C++ one. need to fix
    exec('make', [`CC="${C}"`, 'CFLAGS=-fPIC', 'lib'], status)
    assert(status[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { name, api, libs, obj, includes, include_paths, structs, build }
