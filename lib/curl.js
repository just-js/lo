const { curl } = lo.load('curl')

const { core, assert, wrap } = lo

const {
  global_init, easy_setopt, easy_setopt_2, easy_perform, easy_cleanup,
  global_cleanup, easy_getinfo, easy_setopt_3, fclose,
  CURL_GLOBAL_DEFAULT, CURLOPT_URL, CURLOPT_BUFFERSIZE,
  CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1, CURLOPT_FOLLOWLOCATION,
  CURLINFO_SIZE_DOWNLOAD_T, CURLOPT_WRITEFUNCTION, CURLOPT_WRITEDATA,
  CURLINFO_RESPONSE_CODE, CURLOPT_FAILONERROR
} = curl

const handle = new Uint32Array(2)
const easy_init = wrap(handle, curl.easy_init, 0)
const fopen = wrap(handle, curl.fopen, 2)

let initialized = false

function fetch (url, file_name = '') {
  if (!initialized) {
    assert(global_init(CURL_GLOBAL_DEFAULT) === 0)
  }
  assert(file_name)
  const file_handle = fopen(file_name, 'w+')
  assert(file_handle)
  const curl = assert(easy_init())
  assert(easy_setopt_2(curl, CURLOPT_BUFFERSIZE, 65536) === 0)
  assert(easy_setopt_2(curl, CURLOPT_FOLLOWLOCATION, 1) === 0)
  assert(easy_setopt_2(curl, CURLOPT_FAILONERROR, 1) === 0)
  assert(easy_setopt_2(curl, CURLOPT_WRITEFUNCTION, 0) === 0)
  assert(easy_setopt_3(curl, CURLOPT_WRITEDATA, file_handle) === 0)
  assert(easy_setopt_2(curl, CURLOPT_HTTP_VERSION, 
    CURL_HTTP_VERSION_1_1) === 0)
  assert(easy_setopt(curl, CURLOPT_URL, url) === 0)
  assert(easy_perform(curl) === 0)
  assert(easy_getinfo(curl, CURLINFO_RESPONSE_CODE, handle) === 0)
  const status = assert(lo.addr(handle))
  assert(easy_getinfo(curl, CURLINFO_SIZE_DOWNLOAD_T, handle) === 0)
  const size = assert(lo.addr(handle))
  fclose(file_handle)
  easy_cleanup(curl)
//  global_cleanup()
  return size
}

export { fetch }
