import { fetch } from 'lib/curl.js'
import { exec } from 'lib/proc.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'

const ada_version = '2.7.8'

const { core } = lo
const { read_file, write_file } = core

async function build (CC = 'gcc', CXX = 'g++') {
  const { assert } = lo
  const { chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile, writeFile } = lo.core
  mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
  fetch(`https://codeload.github.com/ada-url/ada/tar.gz/v${ada_version}`, 'deps/ada.tar.gz')
  // TODO: asserts
  chdir('deps')
  const bytes = readFile('ada.tar.gz')
  untar(inflate(bytes))
  chdir('../')
  chdir(`deps/ada-${ada_version}`)
  const status = new Int32Array(2)
  exec('python3', ['singleheader/amalgamate.py'], status)
  assert(status[0] === 0)
  chdir('../../')
  write_file('ada.cpp', read_file(`deps/ada-${ada_version}/singleheader/ada.cpp`))
  write_file('ada_c.h', read_file(`deps/ada-${ada_version}/singleheader/ada_c.h`))
  const CXXARGS = CXX.split(' ')
  exec(CXXARGS[0], [...CXXARGS.slice(1), `-Ideps/ada-${ada_version}/include`, '-O3', '-march=native', '-mtune=native', '-msse4', '-msse4.2', '-mavx2', '-c', 'ada.cpp', '-o', 'ada_cpp.o', '-std=c++17'], status)
  assert(status[0] === 0)
}

export { build }
