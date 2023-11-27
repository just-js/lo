const api = {
  set: {
    parameters: ['pointer'],
    pointers: ['wg_device*'],
    result: 'i32',
    name: 'wg_set_device'
  },
  get: {
    parameters: ['u32array', 'string'],
    pointers: ['wg_device**', 'const char*'],
    result: 'i32',
    name: 'wg_get_device'
  },
  add: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32',
    name: 'wg_add_device'
  },
  delete: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32',
    name: 'wg_del_device'
  },
  free: {
    parameters: ['pointer'],
    pointers: ['wg_device*'],
    result: 'void',
    name: 'wg_free_device'
  },
  list: {
    parameters: [],
    rpointer: 'const char*',
    result: 'pointer',
    name: 'wg_list_device_names'
  },
  keytobase64: {
    parameters: ['buffer', 'buffer'],
    pointers: ['wg_key_b64_string*', 'const wg_key*'],
    casts: ['*', '*'],
    result: 'void',
    name: 'wg_key_to_base64'
  },
  keyfrombase64: {
    parameters: ['buffer', 'buffer'],
    pointers: ['wg_key*', 'const wg_key_b64_string*'],
    casts: ['*', '*'],
    result: 'i32',
    name: 'wg_key_from_base64'
  },
  genpubKey: {
    parameters: ['buffer', 'buffer'],
    pointers: ['wg_key*', 'const wg_key*'],
    casts: ['*', '*'],
    result: 'void',
    name: 'wg_generate_public_key'
  },
  genprivKey: {
    parameters: ['buffer'],
    pointers: ['wg_key*'],
    casts: ['*'],
    result: 'void',
    name: 'wg_generate_private_key'
  },
  genpresharedKey: {
    parameters: ['buffer'],
    pointers: ['wg_key*'],
    casts: ['*'],
    result: 'void',
    name: 'wg_generate_preshared_key'
  }
}

const includes = ['wireguard.h']
const name = 'wireguard'
const obj = ['wg.o']
const libs = []

import { fetch } from 'lib/curl.js'
import { exec } from 'lib/proc.js'
import { inflate } from 'lib/zlib.js'
import { untar } from 'lib/untar.js'

const { assert } = lo
const { chdir, mkdir, S_IRWXU, S_IRWXG, S_IROTH, S_IXOTH, readFile, writeFile } = lo.core

async function build (C = 'gcc', CC = 'g++') {
  mkdir('deps', S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH)
  fetch('https://codeload.github.com/WireGuard/wireguard-tools/tar.gz/master', 'deps/wireguard-tools.tar.gz')
  chdir('deps')
  const bytes = readFile('wireguard-tools.tar.gz')
  untar(inflate(bytes))
  chdir('../')
  const status = new Int32Array(2)
  const CARGS = C.split(' ')
  exec(CARGS[0], [...CARGS.slice(1), '-c', '-mstackrealign', '-fPIC', '-O3', '-Ideps/wireguard-tools-master/contrib/embeddable-wg-library', '-o', 'wg.o', 'deps/wireguard-tools-master/contrib/embeddable-wg-library/wireguard.c'], status)
  assert(status[0] === 0)
  const header = readFile('deps/wireguard-tools-master/contrib/embeddable-wg-library/wireguard.h')
  writeFile('wireguard.h', header)
}

export { api, includes, name, obj, libs, build }
