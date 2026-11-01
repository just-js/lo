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
import { obj, library } from 'lib/sqlite/api.js'

async function build () {
  const { assert, core, getenv } = lo
  const {
    chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile, os
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
  // the library's configuration is lib/sqlite/api.js's `library`: base
  // options, perf options (LO_SQLITE_PERF=0 turns them off) and the enabled
  // extensions. LO_SQLITE_SHARED=1 also builds the shared library
  // (deps/sqlite/libsqlite3.so, .dylib on macos) from the same objects as
  // the static archive linked into lo, so both have the same configuration
  const perf = getenv('LO_SQLITE_PERF') !== '0'
  const shared = getenv('LO_SQLITE_SHARED') === '1'
  const dll = `deps/sqlite/libsqlite3.${os === 'mac' ? 'dylib' : 'so'}`
  const SQLITE_OPTS = [
    ...library.base,
    ...(perf ? library.perf : []),
    ...library.enabled.flatMap(name => {
      assert(library.extensions[name], `unknown sqlite extension ${name}`)
      return library.extensions[name]
    })
  ]
  const C_FLAGS = [
    '-fPIC',
    '-O3',
    '-march=native',
    '-mtune=native',
  ]
  const configure_args = [
    '--disable-readline', '--disable-tcl', '--disable-session',
    '--disable-largefile', '--disable-load-extension'
  ]
  if (perf) configure_args.push('--disable-threadsafe')
  // reconfigure and rebuild from clean when any of these change: the
  // generated parser and amalgamation depend on them
  const stamp = 'deps/sqlite/lo-build-options.txt'
  const options = [
    `CONFIGURE=${configure_args.join(' ')}`,
    `CFLAGS=${C_FLAGS.join(' ')}`,
    `OPTIONS=${SQLITE_OPTS.join(' ')}`,
    ''
  ].join('\n')
  const stale = !isFile(stamp) ||
    new TextDecoder().decode(lo.core.read_file(stamp)) !== options
  if (stale || obj.some(o => !isFile(o)) || (shared && !isFile(dll))) {
    assert(chdir('deps/sqlite') === 0)
    // macos: VERSION is renamed aside after each build (see below), and
    // configure and make need it back
    if (os === 'mac' && !isFile('VERSION') && isFile('VERSION.lo')) {
      assert(lo.core.rename('VERSION.lo', 'VERSION') === 0)
    }
    if (stale || !isFile('Makefile')) {
      assert(exec_env('./configure', configure_args, [
        ['CFLAGS', C_FLAGS.join(' ')],
      ])[0] === 0)
      assert(exec('make', ['clean'])[0] === 0)
    }
    // passed on the make command line: the configured Makefile assigns
    // CFLAGS itself, so CFLAGS from the environment is ignored. OPTIONS
    // (appended to OPT_FEATURE_FLAGS) also reaches the parser generator,
    // which some OMIT/ENABLE flags need
    const targets = ['libsqlite3.a']
    if (shared) targets.push('so')
    assert(exec('make', ['-j', '4', `CFLAGS=${C_FLAGS.join(' ')}`,
      `OPTIONS=${SQLITE_OPTS.join(' ')}`, ...targets])[0] === 0)
    // on macos with clang, VERSION gets included and causes a conflict which
    // breaks the compiler. similar to https://trac.macports.org/ticket/62758
    if (os === 'mac') assert(lo.core.rename('VERSION', 'VERSION.lo') === 0)
    assert(chdir('../../') === 0)
    lo.core.write_file(stamp, new TextEncoder().encode(options))
  }
}

export { build }
