import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec_env, exec } from 'lib/proc.js'
import { obj } from 'lib/libssl/api.js'

async function build () {
  return // don't build external for now - need a way of controlling this when building or in api.js
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
    //const ssl_opts = 'shared no-zlib no-ssl no-tls1 no-dtls no-aria no-bf no-blake2 no-camellia no-cast no-chacha no-cmac no-des no-idea no-mdc2 no-ocb no-poly1305 no-rc2 no-scrypt no-seed no-siphash no-sm3 no-sm4 no-whirlpool no-afalgeng no-deprecated no-capieng no-cms no-comp no-dgram'
    const ssl_opts = 'shared no-zlib no-ssl no-tls1 no-dtls no-aria no-bf no-blake2 no-camellia no-cast no-cmac no-des no-idea no-mdc2 no-ocb no-rc2 no-scrypt no-seed no-siphash no-sm3 no-sm4 no-whirlpool no-afalgeng no-deprecated no-capieng no-cms no-comp no-dgram'
    assert(exec_env('./config', ssl_opts.split(' '), [['CFLAGS', '-fPIC -march=native -mtune=native -m64 -O3']])[0] === 0)
    assert(exec('make', ['clean'])[0] === 0)
    assert(exec_env('make', ['-j', '4'], [['CFLAGS', '-fPIC -march=native -mtune=native -m64 -O3']])[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
