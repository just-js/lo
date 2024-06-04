import { fetch } from 'lib/curl.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec, exec_env } from 'lib/proc.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { obj } from 'lib/mbedtls/api.js'

async function build () {
  const { assert, core } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile
  } = core
  if (obj.some(o => !isFile(o))) {
    if (!isFile('deps/raylib/configure')) {
      mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
      assert(chdir('deps') === 0)
      if (!isFile('raylib.tar.gz')) {
        console.log('fetching release')
        fetch('https://github.com/raysan5/raylib/releases/download/5.0/raylib-5.0_linux_amd64.tar.gz', 
          'raylib.tar.gz')
      }
      const bytes = readFile('raylib.tar.gz')
      const dir_name = untar(inflate(bytes))
      assert(lo.core.rename(dir_name, 'raylib') === 0)
      assert(chdir('../') === 0)
    }
    assert(chdir('deps/raylib') === 0)
    assert(exec_env('./configure', ['--static', '--const'], [['CFLAGS', '-fPIC -mtune=native -O3']])[0] === 0)
    assert(exec('make', ['-j', '4'])[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
