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

// https://github.com/denodrivers/sqlite3/blob/main/scripts/build.ts

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
    const sqlite_opts = `--disable-readline --disable-tcl --disable-session --disable-largefile --disable-threadsafe --disable-load-extension`
    assert(chdir('deps/sqlite') === 0)
    if (!isFile('Makefile')) {
      exec_env('./configure', sqlite_opts.split(' '), [
        ['CFLAGS', '-flto -fPIC -O3 -march=native -mtune=native'],
      ])
    }
    // https://www.sqlite.org/compile.html
    const SQLITE_OPTS = [
      '-DHAVE_FDATASYNC=1',
      '-DSQLITE_CORE=1',
      '-DSQLITE_DEFAULT_FOREIGN_KEYS=1',
      '-DSQLITE_DEFAULT_LOCKING_MODE=1',
      '-DSQLITE_DEFAULT_MEMSTATUS=0',
      '-DSQLITE_DQS=0',
      '-DSQLITE_ENABLE_COLUMN_METADATA=1',
      '-DSQLITE_ENABLE_DESERIALIZE=1',
      '-DSQLITE_ENABLE_FTS5=1',
      '-DSQLITE_ENABLE_JSON1=1',
      '-DSQLITE_ENABLE_MATH_FUNCTIONS',
      '-DSQLITE_ENABLE_MATH_FUNCTIONS=1',
      '-DSQLITE_ENABLE_NORMALIZE=1',
      '-DSQLITE_ENABLE_RTREE=1',
      '-DSQLITE_ENABLE_STAT4=1',
      '-DSQLITE_ENABLE_UPDATE_DELETE_LIMIT=1',
      '-DSQLITE_LIKE_DOESNT_MATCH_BLOBS=1',
      '-DSQLITE_MAX_EXPR_DEPTH=0',
      '-DSQLITE_OMIT_AUTOINIT=1',
      '-DSQLITE_OMIT_COMPLETE=1',
      '-DSQLITE_OMIT_DEPRECATED=1',
      '-DSQLITE_OMIT_GET_TABLE=1',
      '-DSQLITE_OMIT_LOAD_EXTENSION=1',
      '-DSQLITE_OMIT_PROGRESS_CALLBACK=1',
      '-DSQLITE_OMIT_SHARED_CACHE=1',
      '-DSQLITE_OMIT_TCL_VARIABLE=1',
      '-DSQLITE_SOUNDEX=1',
      '-DSQLITE_TRACE_SIZE_LIMIT=32',
      '-DSQLITE_USE_ALLOCA'
    ]
    const C_FLAGS = [
      '-fPIC', 
      '-O3', 
      '-march=native', 
      '-mtune=native',
    ]
    //assert(exec('make', ['clean'])[0] === 0)
    assert(exec_env('make', ['-j', '4', 'libsqlite3.a'], [[
      'CFLAGS', 
      `${C_FLAGS.join(' ')} ${SQLITE_OPTS.join(' ')}`]])[0] === 0)
    if (os === 'mac') unlink('VERSION') // on macos with clang, this gets included and causes a conflict which breaks the compiler. similar to https://trac.macports.org/ticket/62758
    assert(chdir('../../') === 0)
  }
}

export { build }
