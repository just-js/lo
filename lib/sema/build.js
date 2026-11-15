import { fetch } from 'lib/curl.js'
import { exec } from 'lib/proc.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile, readdir_sync } from 'lib/fs.js'

const { assert, getenv, core } = lo
const { chdir, mkdir, read_file, write_file, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH } = core

// Bun's TypeScript checker as a static library: github.com/just-js/ts-sema (README.md there has the requirements and
// build options). Where the archive comes from:
//   TS_SEMA_A=<path to libts_sema.a>   a local build (ts-sema's dist/, which also has ts_sema.h)
//   default                            the prebuilt release asset ts-sema-<target>.tar.gz of release TS_SEMA_REF
//                                      (default ts_sema_ref), for this platform's Rust target (TS_SEMA_TARGET overrides)
//   TS_SEMA_SOURCE=1                   ts-sema's source tarball at TS_SEMA_REF (a release tag or a commit), built in
//                                      deps/ with its own build.js (Node 22+, Rust nightly + cargo, a C compiler, ~3 GB
//                                      of memory for rustc). TS_SEMA_BUILD_ARGS is passed to it, e.g. "--jobs 1 --nice 19".
// Downloads and builds stay in deps/ and are reused. Delete ts_sema.o to pick up a new archive.
const ts_sema_ref = '0.0.4'
const dir_mode = S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH

// The Rust target triple of the release asset for this platform: lo's os/arch, and musl when lo is built with MUSL=1.
function rust_target () {
  const arch = { x64: 'x86_64', arm64: 'aarch64' }[core.arch]
  if (!arch) throw new Error(`no ts-sema build for arch ${core.arch}`)
  if (core.os === 'mac') return `${arch}-apple-darwin`
  if (core.os === 'linux') return `${arch}-unknown-linux-${getenv('MUSL') === '1' ? 'musl' : 'gnu'}`
  throw new Error(`no ts-sema build for os ${core.os}`)
}

// The asset holds one directory, ts-sema-<target>/, unpacked into a fresh deps/ts-sema-<ref>/. (lib/untar.js empties
// and recreates its first directory if it exists, so it only ever runs where that directory is new.)
function fetch_release (ref, target) {
  const parent = `deps/ts-sema-${ref}`
  const dir = `${parent}/ts-sema-${target}`
  if (isDir(dir)) return dir
  mkdir('deps', dir_mode)
  mkdir(parent, dir_mode)
  assert(chdir(parent) === 0)
  fetch(`https://github.com/just-js/ts-sema/releases/download/${ref}/ts-sema-${target}.tar.gz`, 'asset.tar.gz')
  const top = untar(inflate(read_file('asset.tar.gz')))
  const status = new Int32Array(3)
  exec('rm', ['-f', 'asset.tar.gz'], status)
  assert(chdir('../../') === 0)
  assert(top === `ts-sema-${target}/`, `unexpected top directory in the ts-sema asset: ${top}`)
  return dir
}

function fetch_and_build (ref, args) {
  const status = new Int32Array(3)
  mkdir('deps', dir_mode)
  assert(chdir('deps') === 0)
  fetch(`https://codeload.github.com/just-js/ts-sema/tar.gz/${ref}`, 'ts-sema.tar.gz')
  const dir = untar(inflate(read_file('ts-sema.tar.gz')))
  exec('rm', ['-f', 'ts-sema.tar.gz'], status)
  assert(chdir(dir) === 0)
  exec('node', ['build.js', ...args], status)
  assert(status[0] === 0, `ts-sema build.js failed: ${status[0]}`)
  assert(chdir('../../') === 0)
  return `deps/${dir}/dist`
}

// The archive carries Rust's std, mimalloc and Bun's stand-ins for its native C/C++ symbols (mi_*, highway_*,
// compiler-rt builtins, ...), and refers to more of Bun's C/C++ side from code the checker never reaches, so the
// final link needs --gc-sections (lo's runtimes have it). Linking it into one relocatable object and keeping only the
// C ABI global means none of that can clash with lo's or V8's own symbols.
async function build () {
  console.log(isFile('ts_sema.o'))
  console.log(isFile('ts_sema.h'))
  if (isFile('ts_sema.o') && isFile('ts_sema.h')) return
  let dist
  const local = getenv('TS_SEMA_A')
  if (local) {
    if (!isFile(local)) throw new Error(`TS_SEMA_A: ${local} not found`)
    dist = local.slice(0, local.lastIndexOf('/')) || '.'
  } else {
    const ref = getenv('TS_SEMA_REF') || ts_sema_ref
    if (!ref) throw new Error('no ts-sema release pinned yet: set TS_SEMA_A to a local build, or TS_SEMA_REF')
    if (getenv('TS_SEMA_SOURCE') === '1') {
      dist = isDir(`deps/ts-sema-${ref}/dist`) ? `deps/ts-sema-${ref}/dist`
        : fetch_and_build(ref, (getenv('TS_SEMA_BUILD_ARGS') || '').split(' ').filter(Boolean))
    } else {
      dist = fetch_release(ref, getenv('TS_SEMA_TARGET') || rust_target())
    }
  }
  const archive = local || `${dist}/libts_sema.a`
  write_file('ts_sema.h', read_file(`${dist}/ts_sema.h`))
  if (core.os === 'mac') return link_mac(archive)
  const status = new Int32Array(3)
  exec('ld', ['-r', '-o', 'ts_sema.all.o', '--whole-archive', archive], status)
  assert(status[0] === 0)
  // A PGO build's .llvm.call-graph-profile sections come out of GNU `ld -r` with sh_entsize 0, which lld rejects
  // ("invalid sh_entsize"). Dropping them only loses lld's call-graph function ordering.
  exec('objcopy', [...keep.map(s => `--keep-global-symbol=${s}`),
    '--remove-section=.llvm.call-graph-profile', 'ts_sema.all.o', 'ts_sema.o'], status)
  assert(status[0] === 0)
  exec('rm', ['-f', 'ts_sema.all.o'], status)
}

// The C ABI: the only globals left in ts_sema.o.
const keep = ['bun_sema_check', 'bun_sema_free', 'bun_sema_set_libs', 'bun_sema_builtin_lib']

// macOS: Apple's ld has no --whole-archive and there is no GNU objcopy. The members are extracted and linked into
// one relocatable object, and -exported_symbol keeps the C ABI global and makes every other global private, which is
// what objcopy --keep-global-symbol does on Linux. Hiding them is required here, not only tidy: a macOS executable
// exports all its globals and -dead_strip keeps whatever is exported, so the Bun code the checker never reaches
// (and its undefined symbols) would stay. -dead_strip can only remove single functions from an object marked
// MH_SUBSECTIONS_VIA_SYMBOLS, and ld -r marks its output only when every input is: the aarch64 archive's
// compiler-rt lse_* atomics (assembly, referenced by nothing in it; checked on ts-sema 0.0.4) are not, so members
// without the flag are left out.
function link_mac (archive) {
  const status = new Int32Array(3)
  const dir = 'ts_sema.objs'
  const list = 'ts_sema.objs.txt'
  exec('rm', ['-rf', dir, list], status)
  mkdir(dir, dir_mode)
  assert(chdir(dir) === 0)
  exec('ar', ['x', archive.startsWith('/') ? archive : `../${archive}`], status)
  assert(chdir('..') === 0)
  assert(status[0] === 0, `ar x ${archive} failed: ${status[0]}`)
  const objs = []
  for (const entry of readdir_sync(dir)) {
    if (!entry.isFile) continue
    const path = `${dir}/${entry.name}`
    const bytes = read_file(path)
    if (bytes.length < 32) continue
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (view.getUint32(0, true) !== 0xfeedfacf) continue // MH_MAGIC_64; skips the symbol table member
    if (!(view.getUint32(24, true) & 0x2000)) { // MH_SUBSECTIONS_VIA_SYMBOLS
      console.log(`ts_sema: leaving out ${entry.name} (not MH_SUBSECTIONS_VIA_SYMBOLS)`)
      continue
    }
    objs.push(path)
  }
  assert(objs.length > 0, `no objects in ${archive}`)
  write_file(list, new TextEncoder().encode(`${objs.join('\n')}\n`))
  const arch = { arm64: 'arm64', x64: 'x86_64' }[core.arch]
  exec('ld', ['-r', '-arch', arch, '-o', 'ts_sema.o', '-filelist', list,
    ...keep.flatMap(s => ['-exported_symbol', `_${s}`])], status)
  assert(status[0] === 0, `ld -r for ts_sema.o failed: ${status[0]}`)
  exec('rm', ['-rf', dir, list], status)
}

export { build }
