import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec, exec_env } from 'lib/proc.js'
import { obj } from 'lib/zlib/api.js'

async function build () {
  const { assert, core } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile
  } = core
  if (!isDir('deps/zlib')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('zlib.tar.gz')) {
      console.log('fetching release')
      fetch('https://github.com/zlib-ng/zlib-ng/archive/refs/tags/2.0.6.tar.gz', 
        'zlib.tar.gz')
//      fetch('https://github.com/cloudflare/zlib/archive/refs/tags/v1.2.11.tar.gz', 
//        'zlib.tar.gz')
    }
    const bytes = readFile('zlib.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/zlib`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    assert(chdir('deps/zlib') === 0)
    assert(exec_env('./configure', ['--zlib-compat', '--static', '--without-gzfileops', '--native'], [['CFLAGS', '-fPIC -mtune=native -O3']])[0] === 0)
    //assert(exec_env('./configure', [], [['CFLAGS', '-fPIC -mtune=native -m64 -O3']])[0] === 0)
//    assert(exec('make', ['clean'])[0] === 0)
    assert(exec('make', ['-j', '4'])[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
