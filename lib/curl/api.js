const api = {
  fopen: {
    parameters: ['string', 'string'],
    result: 'pointer'
  },
  fclose: {
    parameters: ['pointer'],
    pointers: ['FILE*'],
    result: 'i32'
  },
  global_init: {
    parameters: ['u32'],
    result: 'i32',
    name: 'curl_global_init'
  },
  easy_init: {
    parameters: [],
    result: 'pointer',
    name: 'curl_easy_init'
  },
  easy_setopt: {
    parameters: ['pointer', 'u32', 'string'],
    pointers: ['CURL*'],
    casts: [, '(CURLoption)'],
    result: 'i32',
    name: 'curl_easy_setopt'
  },
  easy_setopt_2: {
    parameters: ['pointer', 'u32', 'u32'],
    result: 'i32',
    pointers: ['CURL*'],
    casts: [, '(CURLoption)'],
    name: 'curl_easy_setopt'
  },
  easy_setopt_3: {
    parameters: ['pointer', 'u32', 'u64'],
    result: 'i32',
    pointers: ['CURL*'],
    casts: [, '(CURLoption)'],
    name: 'curl_easy_setopt'
  },
  easy_perform: {
    parameters: ['pointer'],
    result: 'i32',
    pointers: ['CURL*'],
    name: 'curl_easy_perform'
  },
  easy_cleanup: {
    parameters: ['pointer'],
    result: 'void',
    pointers: ['CURL*'],
    name: 'curl_easy_cleanup'
  },
  global_cleanup: {
    parameters: [],
    result: 'void',
    name: 'curl_global_cleanup'
  },
  easy_getinfo: {
    parameters: ['pointer', 'u32', 'u32array'],
    result: 'i32',
    casts: [, '(CURLINFO)'],
    pointers: ['CURL*'],
    name: 'curl_easy_getinfo'
  },
}
const includes = ['curl/curl.h', 'stdint.h']
const constants = {
  CURLINFO_OFF_T: 'i32', CURL_GLOBAL_DEFAULT: 'i32', CURLOPT_URL: 'i32',
  CURLOPT_BUFFERSIZE: 'i32', CURLOPT_HTTP_VERSION: 'i32', 
  CURL_HTTP_VERSION_1_1: 'i32', CURLOPT_FOLLOWLOCATION: 'i32',
  CURLINFO_SIZE_DOWNLOAD_T: 'i32', CURLOPT_WRITEFUNCTION: 'i32',
  CURLOPT_WRITEDATA: 'i32', CURLINFO_RESPONSE_CODE: 'i32', CURLOPT_FAILONERROR: 'i32'
}
const libs = ['curl']
const name = 'curl'

export { name, api, libs, constants, includes }
