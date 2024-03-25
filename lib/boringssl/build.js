import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec } from 'lib/proc.js'
import { obj } from 'lib/boringssl/api.js'

async function build () {
  const { assert, core } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile
  } = core
  if (!isDir('deps/boringssl')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('boringssl.tar.gz')) {
      console.log('fetching release')
      fetch('https://codeload.github.com/google/boringssl/tar.gz/master', 
        'boringssl.tar.gz')
    }
    const bytes = readFile('boringssl.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/boringssl`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    assert(chdir('deps/boringssl') === 0)
    assert(exec('cmake', ['-DCMAKE_POSITION_INDEPENDENT_CODE=ON', '-DBUILD_SHARED_LIBS=0', '-B', 'build'])[0] === 0)
    assert(exec('make', ['-C', 'build', '-j', '6', 'ssl', 'crypto'])[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
