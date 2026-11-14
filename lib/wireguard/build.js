import { fetch } from 'lib/curl.js'
import { exec } from 'lib/proc.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'

// wireguard-tools release the embeddable library is built from (was the unpinned master branch).
// WG_TOOLS_REF overrides it (a tag or a commit).
const wg_tools_ref = 'v1.0.20260223' // commit 49ce333da02056ae7b22ee2aeb6afe8aaed79b19

// todo: we should pass everything above in so it can be driven from non lo js runtimes
// or we could have a separate build.js script in the same directory as api.js?
async function build (CC = 'gcc', CXX = 'g++') {
  const { assert, getenv } = lo
  const { chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, read_file, write_file } = lo.core
  const ref = getenv('WG_TOOLS_REF') || wg_tools_ref
  mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
  fetch(`https://codeload.github.com/WireGuard/wireguard-tools/tar.gz/${ref}`, 'deps/wireguard-tools.tar.gz')
  chdir('deps')
  const bytes = read_file('wireguard-tools.tar.gz')
  // the tarball's one top directory, e.g. wireguard-tools-1.0.20260223/
  const top = untar(inflate(bytes))
  chdir('../')
  const lib_dir = `deps/${top.replace(/\/$/, '')}/contrib/embeddable-wg-library`
  const status = new Int32Array(3)
  const CARGS = CC.split(' ')
  const ARCH_ARGS = ['-fPIC', '-O3']
  if (lo.core.arch === 'x64') ARCH_ARGS.push('-mstackrealign')
  exec(CARGS[0], [...CARGS.slice(1), '-c', '-I.', ...ARCH_ARGS, `-I${lib_dir}`, '-o', 'wg.o', `${lib_dir}/wireguard.c`], status)
  assert(status[0] === 0)
  write_file('wireguard.h', read_file(`${lib_dir}/wireguard.h`))
}

export { build }
