import { fetch } from 'lib/curl.js'
import { exec } from 'lib/proc.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import * as bindings from 'lib/ada/api.js'

const ada_version = '2.9.1'

const { core, assert } = lo
const { 
  chdir, mkdir, read_file, write_file,
  S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH 
} = core

async function build (CC = 'gcc', CXX = 'g++') {
  const status = new Int32Array(2)
  if (!isDir(`deps/ada-${ada_version}`)) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    fetch(`https://codeload.github.com/ada-url/ada/tar.gz/v${ada_version}`, 'deps/ada.tar.gz')
    assert(chdir('deps') === 0)
    const bytes = read_file('ada.tar.gz')
    untar(inflate(bytes))
    assert(chdir('../') === 0)
    assert(chdir(`deps/ada-${ada_version}`) === 0)
    exec('python3', ['singleheader/amalgamate.py'], status)
    assert(status[0] === 0)
    assert(chdir('../../') === 0)
    write_file('ada.cpp', read_file(`deps/ada-${ada_version}/singleheader/ada.cpp`))
    write_file('ada_c.h', read_file(`deps/ada-${ada_version}/singleheader/ada_c.h`))
  }
  const CXXARGS = CXX.split(' ')
  let obj = (bindings.obj || []).slice(0)
  if (!obj.length) return
  if (obj.some(o => !isFile(o))) {
    exec(CXXARGS[0], [...CXXARGS.slice(1), `-Ideps/ada-${ada_version}/include`, '-fPIC', '-O3', '-march=native', '-mtune=native', '-msse4', '-msse4.2', '-mavx2', '-c', 'ada.cpp', '-o', 'ada_cpp.o', '-std=c++20'], status)
    assert(status[0] === 0)
  }
}

export { build }
