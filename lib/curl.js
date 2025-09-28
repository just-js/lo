const { curl } = lo.load('curl')

const { assert, wrap, ptr, core, utf8_decode } = lo
const { strnlen } = core

const {
  easy_setopt, easy_setopt_2, easy_perform, easy_cleanup, easy_getinfo, 
  easy_setopt_3, easy_setopt_4, easy_setopt_5, fclose, fflush,
  CURLOPT_URL, CURLOPT_BUFFERSIZE, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1, 
  CURLOPT_FOLLOWLOCATION, CURLINFO_SIZE_DOWNLOAD_T, CURLOPT_WRITEFUNCTION, 
  CURLOPT_WRITEDATA, CURLINFO_RESPONSE_CODE, CURLOPT_FAILONERROR, 
  CURLOPT_ERRORBUFFER, CURLOPT_HEADER, CURLOPT_USERAGENT, CURLOPT_HTTPHEADER,
  struct_curl_slist_size, slist_free_all, CURLOPT_REFERER, version, easy_init,
  fopen, fdopen, slist_append
} = curl

const handle = ptr(new Uint32Array(2))
//const easy_init = wrap(handle, curl.easy_init, 0)
//const fopen = wrap(handle, curl.fopen, 2)
//const fdopen = wrap(handle, curl.fdopen, 2)
//const version = wrap(handle, curl.version, 0)
//const slist_append = wrap(handle, curl.slist_append, 2)
const errbuf = ptr(new Uint8Array(65536))
const decoder = new TextDecoder()

const curl_version_ptr = assert(version())
const curl_version = utf8_decode(curl_version_ptr, strnlen(curl_version_ptr, 65536))
const user_agent = curl_version.substring(0, curl_version.indexOf(' ')).trim()

function fetch (url, file_name = '', expected_status = 200) {
  assert(file_name)
  const file_handle = fopen(file_name, 'w+')
  assert(file_handle)
  const curl = assert(easy_init())
  assert(easy_setopt_2(curl, CURLOPT_BUFFERSIZE, 65536) === 0)
  assert(easy_setopt_2(curl, CURLOPT_FOLLOWLOCATION, 1) === 0)
  assert(easy_setopt_2(curl, CURLOPT_FAILONERROR, 1) === 0)
  assert(easy_setopt_2(curl, CURLOPT_WRITEFUNCTION, 0) === 0)
  assert(easy_setopt_3(curl, CURLOPT_WRITEDATA, file_handle) === 0)
  assert(easy_setopt(curl, CURLOPT_USERAGENT, user_agent) === 0)
  assert(easy_setopt_2(curl, CURLOPT_HTTP_VERSION, 
    CURL_HTTP_VERSION_1_1) === 0)
  assert(easy_setopt_3(curl, CURLOPT_ERRORBUFFER, errbuf.ptr) === 0)
  assert(easy_setopt(curl, CURLOPT_URL, url) === 0)
  const ok = easy_perform(curl)
  if(ok !== 0) {
    throw new Error(decoder.decode(errbuf.subarray(0, strnlen(errbuf.ptr, errbuf.length))))
  }
  assert(easy_getinfo(curl, CURLINFO_RESPONSE_CODE, handle.ptr) === 0)
  const status = assert(lo.addr(handle))
  if (status !== expected_status) {
    throw new Error(`status ${status} does not match expected ${expected_status}`)
  }
  assert(easy_getinfo(curl, CURLINFO_SIZE_DOWNLOAD_T, handle.ptr) === 0)
  const size = assert(lo.addr(handle))
  fclose(file_handle)
  easy_cleanup(curl)
  return size
}

function fetch_fd (url, fd, expected_status = 200, headers = {}) {
  const file_handle = fdopen(fd, 'w+')
  assert(file_handle)
  const curl = assert(easy_init())
  assert(easy_setopt_2(curl, CURLOPT_BUFFERSIZE, 65536) === 0)
  assert(easy_setopt_2(curl, CURLOPT_FOLLOWLOCATION, 1) === 0)
  assert(easy_setopt_2(curl, CURLOPT_FAILONERROR, 1) === 0)
  assert(easy_setopt_2(curl, CURLOPT_HEADER, 1) === 0)
  assert(easy_setopt_2(curl, CURLOPT_WRITEFUNCTION, 0) === 0)
  assert(easy_setopt_3(curl, CURLOPT_WRITEDATA, file_handle) === 0)
/*
  const slist = lo.core.calloc(1, struct_curl_slist_size * 2)
//  const slist = ptr(new Uint8Array(struct_curl_slist_size))
  const keys = Object.keys(headers)
  const strings = []
  if (keys.length) {
    let next = slist
    for (const k of keys) {
      console.log(next)
      strings.push(ptr(encoder.encode(`${k}: ${headers[k]}\0`)))
      console.log(`${k}: ${headers[k]}\0`)
      next = slist_append(next, strings[strings.length - 1].ptr)
      console.log(next)
    }
    assert(easy_setopt_4(curl, CURLOPT_HTTPHEADER, slist) === 0)
  }
*/
  assert(easy_setopt(curl, CURLOPT_USERAGENT, user_agent) === 0)
  assert(easy_setopt_2(curl, CURLOPT_HTTP_VERSION, 
    CURL_HTTP_VERSION_1_1) === 0)
  assert(easy_setopt_3(curl, CURLOPT_ERRORBUFFER, errbuf.ptr) === 0)
  assert(easy_setopt(curl, CURLOPT_URL, url) === 0)
  const referer = headers['referer']
  const strings = []
  if (referer) {
    const str = ptr(encoder.encode(`${referer}\0`))
    strings.push(str)
    assert(easy_setopt_4(curl, CURLOPT_REFERER, str.ptr) === 0)
  }
  const ok = easy_perform(curl)
  if(ok !== 0) {
    throw new Error(decoder.decode(errbuf.subarray(0, strnlen(errbuf.ptr, errbuf.length))))
  }
  assert(easy_getinfo(curl, CURLINFO_RESPONSE_CODE, handle.ptr) === 0)
  const status = assert(lo.addr(handle))
  if (status !== expected_status) {
    throw new Error(`status ${status} does not match expected ${expected_status}`)
  }
  assert(easy_getinfo(curl, CURLINFO_SIZE_DOWNLOAD_T, handle.ptr) === 0)
//  slist_free_all(slist)
  const size = assert(lo.addr(handle))
  easy_cleanup(curl)
  fflush(file_handle)
  return { size, status }
}

const encoder = new TextEncoder()

export { fetch, fetch_fd }
