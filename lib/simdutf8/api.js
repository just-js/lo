const api = {
  base64_to_binary_safe: {
    declare_only: true,
    nofast: true
  },
  base64_to_binary_safe_wide: {
    declare_only: true,
    nofast: true
  },
  base64_to_binary_safe_fast: {
    parameters: ['pointer', 'u32', 'string', 'u32'],
    pointers: ['char*', , 'const char*'],
    result: 'u32',
    name: 'base64_decode'
  },
  base64_to_binary_safe_fast2: {
    parameters: ['pointer', 'u32', 'string', 'u32'],
    override: [, , , { param: 2, fastfield: '->length', slowfield: '.length()' }],
    pointers: ['char*', , 'const char*'],
    result: 'u32',
    name: 'base64_decode'
  },
  is_utf8: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'u32',
    name: 'simdutf::validate_utf8'
  },
  utf8_length: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'u32',
    name: 'simdutf::utf8_length_from_latin1'
  },
}

const preamble = `
size_t base64_decode(char* dst, const size_t dstlen,
                     const char* src, const size_t srclen) {
  size_t written_len = dstlen;
  auto result = simdutf::base64_to_binary_safe(
    src,
    srclen,
    dst,
    written_len,
    simdutf::base64_url);
  if (result.error == simdutf::error_code::SUCCESS) {
    return written_len;
  } else {
    return -1;
  }
}

void base64_to_binary_safeSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  char* buf = reinterpret_cast<char*>((uint64_t)Local<Integer>::Cast(args[0])->Value());
  uint32_t buf_len = Local<Integer>::Cast(args[1])->Value();
  String::Utf8Value b64_str(isolate, args[2]);
  uint32_t b64_str_len = Local<Integer>::Cast(args[3])->Value();
  size_t written_len = buf_len;
  auto result = simdutf::base64_to_binary_safe(
    reinterpret_cast<const char*>(*b64_str),
    b64_str_len,
    buf,
    written_len,
    simdutf::base64_url);
  if (result.error == simdutf::error_code::SUCCESS) {
    args.GetReturnValue().Set(Number::New(isolate, written_len));
  } else {
    args.GetReturnValue().Set(Number::New(isolate, -1));
  }
}

void base64_to_binary_safe_wideSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  char* buf = reinterpret_cast<char*>((uint64_t)Local<Integer>::Cast(args[0])->Value());
  uint32_t buf_len = Local<Integer>::Cast(args[1])->Value();
  String::Value b64_str(isolate, args[2]);
  uint32_t b64_str_len = Local<Integer>::Cast(args[3])->Value();
  size_t written_len = buf_len;
  auto result = simdutf::base64_to_binary_safe(
    reinterpret_cast<const char16_t*>(*b64_str),
    b64_str_len,
    buf,
    written_len,
    simdutf::base64_url);
  if (result.error == simdutf::error_code::SUCCESS) {
    args.GetReturnValue().Set(Number::New(isolate, written_len));
  } else {
    args.GetReturnValue().Set(Number::New(isolate, -1));
  }
}

`
const name = 'simdutf8'
const includes = ['simdutf.h']
const include_paths = ['deps/simdutf/include']
const obj = ['deps/simdutf/build/src/libsimdutf.a']

const constants = {}

export { name, api, constants, preamble, include_paths, includes, obj }
