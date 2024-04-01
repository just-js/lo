import { fetch } from 'lib/curl.js'
import { exec } from 'lib/proc.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'

// todo: we should pass everything above in so it can be driven from non lo js runtimes
// or we could have a separate build.js script in the same directory as api.js?
async function build (CC = 'gcc', CXX = 'g++') {
  const { assert } = lo
  const { chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile, writeFile } = lo.core
  mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
  fetch('https://codeload.github.com/WireGuard/wireguard-tools/tar.gz/master', 'deps/wireguard-tools.tar.gz')
  chdir('deps')
  const bytes = readFile('wireguard-tools.tar.gz')
  untar(inflate(bytes))
  chdir('../')
  const status = new Int32Array(2)
  const CARGS = CC.split(' ')
  const ARCH_ARGS = ['-fPIC', '-O3']
  if (lo.core.arch === 'x64') ARCH_ARGS.push('-mstackrealign')
  exec(CARGS[0], [...CARGS.slice(1), '-c', '-I.', ...ARCH_ARGS, '-Ideps/wireguard-tools-master/contrib/embeddable-wg-library', '-o', 'wg.o', 'deps/wireguard-tools-master/contrib/embeddable-wg-library/wireguard.c'], status)
  assert(status[0] === 0)
  const header = readFile('deps/wireguard-tools-master/contrib/embeddable-wg-library/wireguard.h')
  writeFile('wireguard.h', header)
}

export { build }
