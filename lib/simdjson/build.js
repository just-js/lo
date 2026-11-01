// fetches simdjson's single-header amalgamation (simdjson.h + simdjson.cpp) at
// the version in api.js and compiles it, plus the C wrappers in escape.cpp
import { fetch } from 'lib/curl.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec } from 'lib/proc.js'
import { version } from 'lib/simdjson/api.js'

async function build (CC = 'gcc', CXX = 'g++') {
  const { assert, core } = lo
  const { mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH } = core
  const mode = S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH
  const dir = 'deps/simdjson'
  if (!isDir('deps')) mkdir('deps', mode)
  if (!isDir(dir)) mkdir(dir, mode)
  const base = `https://raw.githubusercontent.com/simdjson/simdjson/v${version}/singleheader`
  for (const file of ['simdjson.h', 'simdjson.cpp']) {
    if (!isFile(`${dir}/${file}`)) {
      console.log(`fetching ${file} ${version}`)
      fetch(`${base}/${file}`, `${dir}/${file}`)
      assert(isFile(`${dir}/${file}`))
    }
  }
  const CXXARGS = CXX.split(' ')
  const FLAGS = ['-fPIC', '-O3', '-march=native', '-mtune=native', '-std=c++20', '-DNDEBUG']
  if (!isFile(`${dir}/simdjson.o`)) {
    assert(exec(CXXARGS[0], [...CXXARGS.slice(1), ...FLAGS, '-c', '-o', `${dir}/simdjson.o`,
      `${dir}/simdjson.cpp`])[0] === 0)
  }
  assert(exec(CXXARGS[0], [...CXXARGS.slice(1), ...FLAGS, `-I${dir}`, '-I.', '-c', '-o', 'escape.o',
    'escape.cpp'])[0] === 0)
}

export { build }
