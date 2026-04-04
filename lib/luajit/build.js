import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec, exec_env } from 'lib/proc.js'
import { obj } from 'lib/luajit/api.js'

async function build () {
  const { assert, core, getenv } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile, unlink, os
  } = core
  if (!isDir('deps/luajit')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('luajit.tar.gz')) {
      console.log('fetching release')
      fetch('https://github.com//LuaJIT/LuaJIT/archive/v2.1.tar.gz', 
        'luajit.tar.gz')
    }
    const bytes = readFile('luajit.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/luajit`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    const C_FLAGS = [
      '-fPIC', 
      '-O3', 
      '-march=native', 
      '-mtune=native',
    ]
    assert(chdir('deps/luajit') === 0)
    assert(exec('make', ['clean'])[0] === 0)
    assert(exec_env('make', ['-j', '4', 'BUILDMODE=static'], [[
      'CFLAGS', 
      `${C_FLAGS.join(' ')}`]])[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
