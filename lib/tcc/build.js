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
    const status = new Int32Array(3)
    let EXTRA_FLAGS = '-fPIC'
    if (lo.core.arch === 'x64') EXTRA_FLAGS += ' -mstackrealign'
    // Real CI failure under musl, not guessed: TinyCC's own ./configure
    // detects musl and prints "Perhaps you want ./configure
    // --config-musl" - without it, configure silently sets up a
    // glibc-shaped build that produces zero object files under musl
    // (`ar rcs libtcc.a` with nothing to archive, no top-level error),
    // same MUSL-env-var gating convention the top-level Makefile
    // already uses (`MUSL=1`, set by Dockerfile.alpine).
    const configureArgs = [`--extra-cflags=${EXTRA_FLAGS}`]
    if (lo.getenv('MUSL') === '1') configureArgs.push('--config-musl')
    // Real bug found interactively: TinyCC bakes CONFIG_SYSROOT/
    // CONFIG_TCCDIR into libtcc.a at *this* configure step, entirely
    // separate from the CC used to compile TinyCC's own source. Without
    // --sysroot here, the embedded tcc_compile_string()/tcc_relocate()
    // used at runtime (lib/tcc.js, lib/C.js) fall back to the compiled-in
    // default of plain "/usr/include"/"/usr/lib" for every <...> include
    // and library lookup - fine on a normal Linux host, but this sandbox
    // has no real /usr/include at all (real headers/libs live under
    // $SYSROOT instead, a musl toolchain fetched into a non-standard
    // location - see MUSL.md). Confirmed directly: `#include <stdlib.h>`
    // failed with "include file 'stdlib.h' not found" until this was
    // added. Gated on the SYSROOT env var (already exported by
    // build-module.sh) rather than hardcoded, same convention as MUSL
    // above, so this stays a no-op on a normal host where SYSROOT is unset
    // and /usr/include is real.
    const SYSROOT = lo.getenv('SYSROOT')
    if (SYSROOT) configureArgs.push(`--sysroot=${SYSROOT}`)
    exec('./configure', configureArgs, status)
    if (status[2]) console.error(`./configure killed by signal ${status[2]}`)
    assert(status[0] === 0)
    // libtcc1.a (TinyCC's own runtime helper archive - float conversion
    // shims etc., needed by tcc_relocate() at link time) was never built
    // here before - only libtcc.a (the compiler engine itself). Its
    // Makefile target depends on tcc$(EXESUF), which `make` pulls in
    // automatically as a prerequisite.
    exec('make', [`CC=${CC}`, 'clean', 'libtcc.a', 'libtcc1.a'], status)
    if (status[2]) console.error(`make libtcc.a killed by signal ${status[2]}`)
    assert(status[0] === 0)
    // Install libtcc1.a where TinyCC's own compiled-in default lib path
    // ({B}, i.e. CONFIG_TCCDIR - unaffected by --sysroot, see tcc.h)
    // expects to find it - the same location TinyCC's own upstream `make
    // install` uses, not a sandbox-specific path, so this is a no-op-safe
    // step on any host. Confirmed directly: tcc_relocate() failed with
    // "file 'libtcc1.a' not found" (and "library 'c' not found", fixed by
    // --sysroot above) before this was added.
    exec('mkdir', ['-p', '/usr/local/lib/tcc'], status)
    assert(status[0] === 0)
    exec('cp', ['libtcc1.a', '/usr/local/lib/tcc/libtcc1.a'], status)
    assert(status[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { build }
