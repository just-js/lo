const api = {
  tcc_new: {
    parameters: [],
    result: 'pointer'
  },
  tcc_delete: {
    parameters: ['pointer'],
    pointers: ['TCCState*'],
    result: 'void'
  },
  tcc_set_output_type: {
    parameters: ['pointer', 'i32'],
    pointers: ['TCCState*'],
    result: 'i32'
  },
  tcc_set_options: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'void'
  },
  tcc_add_library_path: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_add_library: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_add_include_path: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_add_file: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_compile_string: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  },
  tcc_relocate: {
    parameters: ['pointer', 'pointer'],
    pointers: ['TCCState*', 'void*'],
    result: 'i32'
  },
  tcc_get_symbol: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'pointer'
  },
  tcc_add_symbol: {
    parameters: ['pointer', 'string', 'pointer'],
    pointers: ['TCCState*', 'const char*', 'const void*'],
    result: 'i32'
  },
  tcc_output_file: {
    parameters: ['pointer', 'string'],
    pointers: ['TCCState*', 'const char*'],
    result: 'i32'
  }
}

const name = 'tcc'
const includes = ['libtcc.h']
const libs = ['tcc']
const obj = ['deps/libtcc/libtcc.a']

import { fetch } from 'lib/curl.js'
import { inflate } from 'lib/inflate.js'
import { untar } from 'lib/untar.js'
import { isDir, isFile } from 'lib/fs.js'
import { exec_env, exec } from 'lib/proc.js'

async function build (C = 'gcc', CC = 'g++') {
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
    const status = new Int32Array(2)
    let EXTRA_FLAGS = '-fPIC'
    if (lo.core.arch === 'x64') EXTRA_FLAGS += ' -mstackrealign'
    exec('./configure', [`--extra-cflags=${EXTRA_FLAGS}`], status)
    assert(status[0] === 0)
    exec('make', [`CC=${C}`, 'clean', 'libtcc.a'], status)
    assert(status[0] === 0)
    assert(chdir('../../') === 0)
  }
}

export { api, includes, name, libs, obj, build }
