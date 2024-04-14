/*
deps: 
	mkdir -p deps
	curl -L -o deps/sqlite.tar.gz https://www.sqlite.org/src/tarball/sqlite.tar.gz?r=release
	tar -zxvf deps/sqlite.tar.gz -C deps/

deps/sqlite/build/.libs/libsqlite3.a: deps ## dependencies
	mkdir -p deps/sqlite/build
	cd deps/sqlite/build && ../configure --disable-math --disable-readline --disable-tcl --with-pic --enable-session && make

library: deps/sqlite/build/.libs/libsqlite3.a ## build shared library
*/



// https://github.com/curl/curl/releases/download/curl-8_5_0/curl-8.5.0.tar.gz

import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec, exec_env } from 'lib/proc.js'
import { obj } from 'lib/sqlite/api.js'

async function build () {
  const { assert, core, getenv } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile, unlink, os
  } = core
  if (!isDir('deps/sqlite')) {
    mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
    assert(chdir('deps') === 0)
    if (!isFile('sqlite.tar.gz')) {
      console.log('fetching release')
      fetch('https://www.sqlite.org/src/tarball/sqlite.tar.gz?r=release', 
        'sqlite.tar.gz')
    }
    const bytes = readFile('sqlite.tar.gz')
    const dir_name = untar(inflate(bytes))
    const cwd = lo.getcwd()
    assert(lo.core.rename(`${cwd}/${dir_name}`, `${cwd}/sqlite`) === 0)
    assert(chdir('../') === 0)
  }
  if (obj.some(o => !isFile(o))) {
    const sqlite_opts = `--disable-math --disable-readline --disable-tcl --with-pic --enable-session`
    assert(chdir('deps/sqlite') === 0)
    if (!isFile('Makefile')) {
      exec_env('./configure', sqlite_opts.split(' '), [['CFLAGS', '-fPIC -O3 -march=native -mtune=native']])
    }
//    assert(exec('make', ['clean'])[0] === 0)
    assert(exec_env('make', ['-j', '4'], [['CFLAGS', '-fPIC -O3 -march=native -mtune=native -DSQLITE_CORE -DSQLITE_DQS=0 -DSQLITE_THREADSAFE=0 -DSQLITE_DEFAULT_MEMSTATUS=0 -DSQLITE_LIKE_DOESNT_MATCH_BLOBS -DSQLITE_OMIT_AUTOINIT -DSQLITE_OMIT_COMPLETE -DSQLITE_OMIT_DECLTYPE -DSQLITE_OMIT_DEPRECATED -DSQLITE_OMIT_PROGRESS_CALLBACK -DSQLITE_OMIT_SHARED_CACHE -DSQLITE_ENABLE_DESERIALIZE -DSQLITE_ENABLE_FTS5 -DSQLITE_ENABLE_JSON1 -DSQLITE_ENABLE_MATH_FUNCTIONS -DSQLITE_ENABLE_NORMALIZE -DSQLITE_ENABLE_STAT4']])[0] === 0)
    if (os === 'mac') unlink('VERSION') // on macos with clang, this gets included and causes an conflict which breaks the compiler. similar to https://trac.macports.org/ticket/62758
    assert(chdir('../../') === 0)
  }
}

export { build }
