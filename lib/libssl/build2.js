import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec } from 'lib/proc.js'
import { obj } from 'lib/mbedtls/api.js'

async function build (C = 'gcc', CC = 'g++') {
  const { assert, core } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile
  } = core
  if (!isDir('deps/openssl')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('openssl-3.0.12.tar.gz')) {
      console.log('fetching release')
      fetch('https://www.openssl.org/source/openssl-3.0.12.tar.gz', 
        'openssl-3.0.12.tar.gz')
    }
    const bytes = readFile('openssl-3.0.12.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/openssl`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    assert(chdir('deps/openssl') === 0)
    //const status = new Int32Array(2)

    // CFLAGS='-fPIC -mtune=native -m64 -O3' ./config shared zlib no-ssl no-tls1 no-dtls no-aria no-bf no-blake2 no-camellia no-cast no-chacha no-cmac no-des no-idea no-mdc2 no-ocb no-poly1305 no-rc2 no-scrypt no-seed no-siphash no-sm3 no-sm4 no-whirlpool no-afalgeng no-deprecated no-capieng no-cms no-comp no-dgram no-threads && make clean build_generated && make -j 6

    // this fixes an issue using g++ to compile C code as CC should really be the C compiler, not the C++ one. need to fix
    //exec('make', [`CC="${C}"`, 'CFLAGS="-fPIC -mtune=native -m64 -O3"', 'lib'], status)
    //assert(status[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
