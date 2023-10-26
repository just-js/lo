import { bind } from 'lib/fast.js'
import { fs } from 'lib/fs.js'
import { net } from 'lib/net.js'
import * as _ from 'lib/compat.js'

const { dlopen, dlsym, assert, wrap, args } = spin
const handle = assert(dlopen('libcurl.so', 1))
const { defaultWriteFlags, defaultWriteMode } = fs

const CURL_GLOBAL_DEFAULT = 3
const CURLOPT_URL = 10002
const CURLOPT_BUFFERSIZE = 98
const CURLOPT_HTTP_VERSION = 84
const CURL_HTTP_VERSION_1_1 = 2

const curl_global_init = bind(assert(dlsym(handle, 'curl_global_init')), 
  'i32', ['u32'])
const curl_easy_init = wrap(new Uint32Array(2), bind(assert(dlsym(handle, 
  'curl_easy_init')), 'pointer', []), 0)
const curl_easy_setopt = bind(assert(dlsym(handle, 'curl_easy_setopt')), 'i32', 
  ['pointer', 'u32', 'string'])
const curl_easy_setopt2 = bind(assert(dlsym(handle, 'curl_easy_setopt')), 'i32', 
  ['pointer', 'u32', 'u32'])
const curl_easy_perform = bind(assert(dlsym(handle, 'curl_easy_perform')), 
  'i32', ['pointer'])
const curl_easy_cleanup = bind(assert(dlsym(handle, 'curl_easy_cleanup')), 
  'i32', ['pointer'])
const curl_global_cleanup = bind(assert(dlsym(handle, 'curl_global_cleanup')), 
  'i32', [])

const [ 
  url = 'https://codeload.github.com/just-js/just/tar.gz/refs/tags/0.1.13', 
  file_name = '/dev/null' 
] = args.slice(2)

const fd = fs.open(file_name, defaultWriteFlags, defaultWriteMode)
assert(fd > 2)
net.dup2(fd, 1)

assert(curl_global_init(CURL_GLOBAL_DEFAULT) === 0)
const curl = assert(curl_easy_init())
assert(curl_easy_setopt2(curl, CURLOPT_BUFFERSIZE, 65536) === 0)
assert(curl_easy_setopt2(curl, CURLOPT_HTTP_VERSION, 
  CURL_HTTP_VERSION_1_1) === 0)
assert(curl_easy_setopt(curl, CURLOPT_URL, url) === 0)

const start = spin.hrtime()
assert(curl_easy_perform(curl) === 0)
const elapsed = spin.hrtime() - start
console.error(elapsed / 1e6)
console.error(runtime.mem())

curl_easy_cleanup(curl)
curl_global_cleanup()
