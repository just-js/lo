import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec } from 'lib/proc.js'
import { obj } from 'lib/md4c/api.js'

async function build () {
  const { assert, core } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile
  } = core
  if (!isDir('deps/md4c')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('md4c.tar.gz')) {
      console.log('fetching release')
      fetch('https://github.com/mity/md4c/archive/refs/tags/release-0.5.2.tar.gz', 
        'md4c.tar.gz')
    }
    const bytes = readFile('md4c.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/md4c`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    assert(chdir('deps/md4c') === 0)
    assert(exec('cmake', ['-DBUILD_SHARED_LIBS=ON', '-B', 'build'])[0] === 0)
    assert(exec('make', ['-C', 'build', '-j', '6'])[0] === 0)
    assert(exec('cmake', ['-DBUILD_SHARED_LIBS=OFF', '-B', 'build'])[0] === 0)
    assert(exec('make', ['-C', 'build', '-j', '6'])[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
