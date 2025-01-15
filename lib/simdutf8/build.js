import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec } from 'lib/proc.js'
import { obj } from 'lib/simdutf8/api.js'

async function build () {
  const { assert, core } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile
  } = core
  if (!isDir('deps/simdutf')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('simdutf.tar.gz')) {
      console.log('fetching release')
      fetch('https://codeload.github.com/simdutf/simdutf/tar.gz/v5.2.8', 
        'simdutf.tar.gz')
    }
    const bytes = readFile('simdutf.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/simdutf`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    assert(chdir('deps/simdutf') === 0)
    assert(exec('cmake', ['-DCMAKE_POSITION_INDEPENDENT_CODE=ON', '-B', 'build'])[0] === 0)
    assert(exec('make', ['-C', 'build', '-j', '6'])[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
