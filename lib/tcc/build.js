import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec_env, exec } from 'lib/proc.js'
import { obj } from 'lib/tcc/api.js'

async function build (CC = 'gcc', CXX = 'g++') {
  const { assert } = lo
  const { chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile } = lo.core
  if (!isDir('deps/libtcc')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    fetch('https://github.com/TinyCC/tinycc/archive/refs/heads/mob.tar.gz', 'deps/mob.tar.gz')
    assert(chdir('deps') === 0)
    const bytes = readFile('mob.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/libtcc`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    assert(chdir('deps/libtcc') === 0)
    const status = new Int32Array(2)
    let EXTRA_FLAGS = '-fPIC'
    if (lo.core.arch === 'x64') EXTRA_FLAGS += ' -mstackrealign'
    exec('./configure', [`--extra-cflags=${EXTRA_FLAGS}`], status)
    assert(status[0] === 0)
    exec('make', [`CC=${CC}`, 'clean', 'libtcc.a'], status)
    assert(status[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
