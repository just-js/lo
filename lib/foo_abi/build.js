import { exec } from 'lib/proc.js'
import { isFile } from 'lib/fs.js'
import * as bindings from 'lib/foo_abi/api.js'

// Compiles the shared lo_abi.h V8 backend (repos root's lo_abi_v8.cc) into
// this binding's own lo_abi_v8.o, linked in via api.js's obj: [] (see
// lib/ada/build.js for the same "compile a companion .cc into a local .o"
// pattern). compile_bindings (lib/build.js) passes its own CFLAGS as the
// 3rd arg here rather than us importing it -- lib/build.js is still
// mid-evaluation (inside compile_bindings) when it dynamically imports
// this file, so `import { CFLAGS } from 'lib/build.js'` here is a real
// circular import and resolves to a namespace missing the export. CFLAGS
// must match exactly what the rest of the binary was built with
// (V8_COMPRESS_POINTERS/etc.) or V8::Initialize() hard-aborts on a
// build-config mismatch (see lib/build.js:660-664) -- taking it as a
// parameter from the one place that already computed it correctly avoids
// a second, driftable copy of that literal.
async function build (CC = 'gcc', CXX = 'g++', CFLAGS = []) {
  const { assert, getenv } = lo
  const LO_HOME = getenv('LO_HOME') || '.'
  const obj = (bindings.obj || []).slice(0)
  if (obj.some(o => !isFile(o))) {
    const status = new Int32Array(3)
    const CXXARGS = CXX.split(' ')
    exec(CXXARGS[0], [
      ...CXXARGS.slice(1), ...CFLAGS,
      '-O3', '-march=native', '-mtune=native',
      `-I${LO_HOME}`, `-I${LO_HOME}/v8`, `-I${LO_HOME}/v8/include`,
      `${LO_HOME}/lo_abi_v8.cc`, '-o', 'lo_abi_v8.o'
    ], status)
    assert(status[0] === 0)
  }
}

export { build }
