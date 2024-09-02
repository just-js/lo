import { isDir, isFile } from 'lib/fs.js'
import { exec } from 'lib/proc.js'
import { obj } from 'lib/duckdb/api.js'

async function build (CC = 'gcc', CXX = 'g++') {
  const { assert } = lo
  const { chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH } = lo.core
  const status = new Int32Array(2)

  if (!isDir('deps/duckdb')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    exec('git', ['clone', '--depth', '1', '--single-branch', '-b', 'v0.9.2', 'https://github.com/duckdb/duckdb.git'], status)
    assert(status[0] === 0)
    assert(chdir('../') === 0)
  }

  if (obj.some(o => !isFile(o))) {
    assert(chdir('deps/duckdb') === 0)
    if (!isFile('duckdb.o')) {
      exec('python3', ['scripts/amalgamation.py'], status)
      exec(CXX.split(' ')[0], [...CXX.split(' ').slice(1), '-std=c++20', '-fPIC', '-c', '-O3', '-o', 'duckdb.o', '-Isrc/amalgamation', 'src/amalgamation/duckdb.cpp'], status)
      assert(status[0] === 0)
    }
    assert(chdir('../../') === 0)
  }
}

export { build }
