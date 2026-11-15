import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec } from 'lib/proc.js'
import { obj } from 'lib/mbedtls/api.js'

async function build (CC = 'gcc', CXX = 'g++') {
  const { assert, core } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile, writeFile
  } = core
  if (!isDir('deps/mbedtls')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('v3.5.1.tar.gz')) {
      console.log('fetching release')
      fetch('https://github.com/Mbed-TLS/mbedtls/archive/refs/tags/v3.5.1.tar.gz', 
        'v3.5.1.tar.gz')
    }
    const bytes = readFile('v3.5.1.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/mbedtls`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    writeFile('deps/mbedtls/include/mbedtls/mbedtls_config.h', readFile('./mbedtls_config.h'))
    assert(chdir('deps/mbedtls') === 0)
    const status = new Int32Array(3)
    // The release ships these two generated files, but unlike its other generated files mbedtls 3.5.1's
    // library/Makefile (lines 359-361) rebuilds them whenever generate_driver_wrappers.py or its .jinja templates are
    // newer. lib/untar.js stamps every file with the time it was unpacked, so that varies from run to run, and the
    // regeneration needs python3 with jsonschema and jinja2 (an intermittent macOS CI failure, 2026-11-15). Making
    // them newer than their inputs means make never regenerates them. -c: don't create a file that isn't shipped.
    exec('touch', ['-c', 'library/psa_crypto_driver_wrappers.h', 'library/psa_crypto_driver_wrappers_no_static.c'], status)
    assert(status[0] === 0)
    // this fixes an issue using g++ to compile C code as CC should really be the C compiler, not the C++ one. need to fix
    //if (lo.core.os === 'mac') {
    //  exec('make', ['CFLAGS="-fPIC"', 'lib'], status)
    //} else {
      exec('make', [`CC=${CC}`, 'CFLAGS="-fPIC"', 'lib'], status)
    //}
    assert(status[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
