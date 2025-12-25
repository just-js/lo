import { fetch } from 'lib/curl.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec, exec_env } from 'lib/proc.js'
import { obj } from 'lib/cfzlib/api.js'

async function build () {
  const { assert, core } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile
  } = core
  if (obj.some(o => !isFile(o))) {
    if (!isDir('deps/zlib')) {
      mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
      assert(chdir('deps') === 0)
      if (!isFile('zlib.tar.gz')) {
        console.log('fetching release')
        fetch('https://codeload.github.com/cloudflare/zlib/zip/1252e2565573fe150897c9d8b44d3453396575ff', 
          'zlib.zip')
      }
      exec('unzip', ['-o', 'zlib.zip'])
      const cwd = lo.getcwd()
      assert(lo.core.rename(`${cwd}/zlib-1252e2565573fe150897c9d8b44d3453396575ff`, `${cwd}/zlib`) === 0)
      assert(chdir('../') === 0)
    }
    assert(chdir('deps/zlib') === 0)
    // todo: --64 fails on raspberry pi for some reason
//    assert(exec_env('./configure', ['--static', '--const', '--64'], [['CFLAGS', '-fPIC -mtune=native -m64 -O3']])[0] === 0)
    assert(exec_env('./configure', ['--static', '--const'], [['CFLAGS', '-fPIC -mtune=native -O3 -Doff64_t=__off64_t']])[0] === 0)
    assert(exec('make', ['-j', '4'])[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
