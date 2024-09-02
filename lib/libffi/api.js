const api = {
  ffi_prep_cif: {
    parameters: ['buffer', 'u32', 'u32', 'buffer', 'buffer'],
    pointers: ['ffi_cif*', , , 'ffi_type*', 'ffi_type**'],
    casts: [, '(ffi_abi)'],
    result: 'i32'
  },
  ffi_call: {
    parameters: ['buffer', 'pointer', 'u32array', 'buffer'],
    pointers: ['ffi_cif*', 'callback', , 'void**'],
    result: 'void'
  },
  bindFastApi: {
    declare_only: true,
    nofast: true,
    name: 'bindFastApi'
  },
  bindSlowApi: {
    declare_only: true,
    nofast: true,
    name: 'bindSlowApi'
  }
}

const preamble = `
typedef void (*callback)();

struct foreignFunction {
  void* fast;
  void* ffi;
  void** values;
  void* start;
  v8::CFunction* cfunc;
  ffi_cif* cif;
  FastTypes rc;
  FastTypes* params;
  int nargs;
};

inline uint8_t needsunwrap (lo::FastTypes t) {
  if (t == lo::FastTypes::buffer) return 1;
  if (t == lo::FastTypes::u32array) return 1;
  if (t == lo::FastTypes::pointer) return 1;
  if (t == lo::FastTypes::u64) return 1;
  if (t == lo::FastTypes::i64) return 1;
  return 0;
}

v8::CTypeInfo* CTypeFromV8 (uint8_t v8Type) {
  if (v8Type == lo::FastTypes::boolean)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kBool);
  if (v8Type == lo::FastTypes::i8)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  if (v8Type == lo::FastTypes::i16)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  if (v8Type == lo::FastTypes::i32)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  if (v8Type == lo::FastTypes::u8)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  if (v8Type == lo::FastTypes::u16)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  if (v8Type == lo::FastTypes::u32)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  if (v8Type == lo::FastTypes::f32)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kFloat32);
  if (v8Type == lo::FastTypes::f64)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kFloat64);
  if (v8Type == lo::FastTypes::i64)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt64);
  if (v8Type == lo::FastTypes::u64)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == lo::FastTypes::iSize)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt64);
  if (v8Type == lo::FastTypes::uSize)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == lo::FastTypes::pointer)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == lo::FastTypes::function)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == lo::FastTypes::string)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kSeqOneByteString);
  if (v8Type == lo::FastTypes::buffer) {
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint8,
      v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  }
  if (v8Type == lo::FastTypes::u32array) {
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32,
      v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  }
  return new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
}

ffi_type* FFITypeFromV8 (uint8_t v8Type) {
  if (v8Type == lo::FastTypes::boolean)
    return &ffi_type_uint8;
  if (v8Type == lo::FastTypes::i8)
    return &ffi_type_sint8;
  if (v8Type == lo::FastTypes::i16)
    return &ffi_type_sint16;
  if (v8Type == lo::FastTypes::i32)
    return &ffi_type_sint32;
  if (v8Type == lo::FastTypes::u8)
    return &ffi_type_uint8;
  if (v8Type == lo::FastTypes::u16)
    return &ffi_type_uint16;
  if (v8Type == lo::FastTypes::u32)
    return &ffi_type_uint32;
  if (v8Type == lo::FastTypes::f32)
    return &ffi_type_float;
  if (v8Type == lo::FastTypes::f64)
    return &ffi_type_double;
  if (v8Type == lo::FastTypes::i64)
    return &ffi_type_sint64;
  if (v8Type == lo::FastTypes::u64)
    return &ffi_type_uint64;
  if (v8Type == lo::FastTypes::iSize)
    return &ffi_type_sint64;
  if (v8Type == lo::FastTypes::uSize)
    return &ffi_type_uint64;
  if (v8Type == lo::FastTypes::pointer)
    return &ffi_type_pointer;
  if (v8Type == lo::FastTypes::function)
    return &ffi_type_pointer;
  if (v8Type == lo::FastTypes::string)
    return &ffi_type_pointer;
  if (v8Type == lo::FastTypes::buffer)
    return &ffi_type_pointer;
  if (v8Type == lo::FastTypes::u32array)
    return &ffi_type_pointer;
  return &ffi_type_void;
}

// 10 ns if this fn does nothing
// 46 ns for int fn (int)
// 4ns for looping through and allocating args
// 4ns return
// 30 ns for the ffi call

void SlowCallback(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  foreignFunction* ffn = (foreignFunction*)args.Data()
    .As<Object>()->GetAlignedPointerFromInternalField(1);
  ffi_cif* cif = ffn->cif;
  ffi_arg result;
  uint8_t* start = (uint8_t*)ffn->start;
  for (int i = 0; i < ffn->nargs; i++) {
    if (ffn->params[i] == lo::FastTypes::i32) {
      *(int32_t*)start = (int32_t)Local<Integer>::Cast(args[i])->Value();
      start += 4;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u32) {
      *(uint32_t*)start = (uint32_t)Local<Integer>::Cast(args[i])->Value();
      start += 4;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u16) {
      *(uint16_t*)start = (uint16_t)Local<Integer>::Cast(args[i])->Value();
      start += 2;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u8) {
      *(uint8_t*)start = (uint8_t)Local<Integer>::Cast(args[i])->Value();
      start += 1;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u64) {
      *(uint64_t*)start = (uint64_t)Local<Integer>::Cast(args[i])->Value();
      start += 8;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::pointer) {
      *(uint64_t*)start = (uint64_t)Local<Integer>::Cast(args[i])->Value();
      start += 8;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::buffer) {
      Local<Uint8Array> u8 = args[i].As<Uint8Array>();
      uint8_t* ptr = (uint8_t*)u8->Buffer()->Data() + u8->ByteOffset();
      *(uint64_t*)start = (uint64_t)ptr;
      start += 8;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u32array) {
      Local<Uint32Array> u32 = args[i].As<Uint32Array>();
      uint8_t* ptr = (uint8_t*)u32->Buffer()->Data() + u32->ByteOffset();
      *(uint64_t*)start = (uint64_t)ptr;
      start += 8;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::string) {
      String::Utf8Value arg0(isolate, args[i]);
      *(uint64_t*)start = (uint64_t)strdup(*arg0);
      start += 8;
      continue;
    }
  }
  ffi_call(cif, FFI_FN(ffn->ffi), &result, ffn->values);
  if (args.Length() > ffn->nargs) {
    uint64_t* res = (uint64_t*)args[ffn->nargs].As<Uint32Array>()->Buffer()->Data();
    *res = (uint64_t)result;
    return;
  }
  if (ffn->rc == lo::FastTypes::i32) {
    args.GetReturnValue().Set(Integer::New(isolate, (int32_t)result));
    return;
  }
  if (ffn->rc == lo::FastTypes::u32) {
    args.GetReturnValue().Set(Integer::New(isolate, (uint32_t)result));
    return;
  }
}

void bindSlowApiSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  void* fn = reinterpret_cast<void*>(Local<Integer>::Cast(args[0])->Value());
  void* wrapped = reinterpret_cast<void*>(Local<Integer>::Cast(args[1])->Value());
  int rtype = Local<Integer>::Cast(args[2])->Value();
  Local<Array> params = args[3].As<Array>();
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
  ffi_cif* cif = (ffi_cif*)calloc(1, sizeof(ffi_cif));
  foreignFunction* ffn = new foreignFunction();
  ffn->fast = wrapped;
  ffn->ffi = fn;
  ffn->cif = cif;
  data->SetAlignedPointerInInternalField(1, ffn);
  int len = params->Length();
  ffi_type* ffirc = FFITypeFromV8(rtype);
  ffn->rc = (FastTypes)rtype;
  ffi_type** ffiargs = (ffi_type**)calloc(len, sizeof(ffi_type*));
  ffn->params = (FastTypes*)calloc(len, sizeof(FastTypes));
  ffn->nargs = len;
  ffn->values = (void**)calloc(ffn->nargs, sizeof(void*));
  int fastlen = len + 1 + needsunwrap((FastTypes)rtype);
  CTypeInfo* cargs = (CTypeInfo*)calloc(fastlen, sizeof(CTypeInfo));
  cargs[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  int size = 0;
  for (int i = 0; i < len; i++) {
    uint8_t ptype = Local<Integer>::Cast(
      params->Get(context, i).ToLocalChecked())->Value();
    cargs[i + 1] = *CTypeFromV8(ptype);
    ffiargs[i] = FFITypeFromV8(ptype);
    ffn->params[i] = (FastTypes)ptype;
    if (ffn->params[i] == lo::FastTypes::u8) {
      size += 1;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u16) {
      size += 2;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::i32) {
      size += 4;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u32) {
      size += 4;
      continue;
    }
    size += 8;
  }
  ffn->start = calloc(1, size);
  uint8_t* start = (uint8_t*)ffn->start;
  for (int i = 0; i < ffn->nargs; i++) {
    if (ffn->params[i] == lo::FastTypes::u8) {
      ffn->values[i] = start;
      start += 1;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u16) {
      ffn->values[i] = start;
      start += 2;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::i32) {
      ffn->values[i] = start;
      start += 4;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u32) {
      ffn->values[i] = start;
      start += 4;
      continue;
    }
    ffn->values[i] = start;
    start += 8;
  }
  if (fastlen - 1 > len) {
    cargs[fastlen - 1] = *CTypeFromV8(FastTypes::u32array);
  }
  ffi_status status = ffi_prep_cif(cif, FFI_DEFAULT_ABI, len, ffirc, ffiargs);
  if (status != FFI_OK) {
    // TODO: fix this api
    return;
  }
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(
    isolate,
    SlowCallback,
    data,
    Local<Signature>(),
    0,
    ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect,
    NULL
  );
  Local<Function> fun =
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}

void bindFastApiSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  void* fn = reinterpret_cast<void*>(Local<Integer>::Cast(args[0])->Value());
  void* wrapped = reinterpret_cast<void*>(Local<Integer>::Cast(args[1])->Value());
  int rtype = Local<Integer>::Cast(args[2])->Value();
  Local<Array> params = args[3].As<Array>();

  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
  ffi_cif* cif = (ffi_cif*)calloc(1, sizeof(ffi_cif));
  foreignFunction* ffn = new foreignFunction();
  ffn->fast = wrapped;
  ffn->ffi = fn;
  ffn->cif = cif;
  data->SetAlignedPointerInInternalField(1, ffn);
  int len = params->Length();
  ffi_type* ffirc = FFITypeFromV8(rtype);
  CTypeInfo* rc;
  if (needsunwrap((FastTypes)rtype)) {
    rc = CTypeFromV8(FastTypes::empty);
  } else {
    rc = CTypeFromV8((FastTypes)rtype);
  }
  ffn->rc = (FastTypes)rtype;
  ffi_type** ffiargs = (ffi_type**)calloc(len, sizeof(ffi_type*));
  ffn->params = (FastTypes*)calloc(len, sizeof(FastTypes));
  ffn->nargs = len;
  ffn->values = (void**)calloc(ffn->nargs, sizeof(void*));
  int fastlen = len + 1 + needsunwrap((FastTypes)rtype);
  CTypeInfo* cargs = (CTypeInfo*)calloc(fastlen, sizeof(CTypeInfo));
  cargs[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  int size = 0;
  for (int i = 0; i < len; i++) {
    uint8_t ptype = Local<Integer>::Cast(
      params->Get(context, i).ToLocalChecked())->Value();
    cargs[i + 1] = *CTypeFromV8(ptype);
    ffiargs[i] = FFITypeFromV8(ptype);
    ffn->params[i] = (FastTypes)ptype;
    if (ffn->params[i] == lo::FastTypes::u8) {
      size += 1;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u16) {
      size += 2;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::i32) {
      size += 4;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u32) {
      size += 4;
      continue;
    }
    size += 8;
  }
  ffn->start = calloc(1, size);
  uint8_t* start = (uint8_t*)ffn->start;
  for (int i = 0; i < ffn->nargs; i++) {
    if (ffn->params[i] == lo::FastTypes::u8) {
      ffn->values[i] = start;
      start += 1;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u16) {
      ffn->values[i] = start;
      start += 2;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::i32) {
      ffn->values[i] = start;
      start += 4;
      continue;
    }
    if (ffn->params[i] == lo::FastTypes::u32) {
      ffn->values[i] = start;
      start += 4;
      continue;
    }
    ffn->values[i] = start;
    start += 8;
  }
  if (fastlen - 1 > len) {
    cargs[fastlen - 1] = *CTypeFromV8(FastTypes::u32array);
  }
  ffi_status status = ffi_prep_cif(cif, FFI_DEFAULT_ABI, len, ffirc, ffiargs);
  if (status != FFI_OK) {
    // TODO: fix this api
    return;
  }
  CFunctionInfo* info = new CFunctionInfo(*rc, fastlen, cargs);
  CFunction* fastCFunc = new CFunction(wrapped, info);
  ffn->cfunc = fastCFunc;
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(
    isolate,
    SlowCallback,
    data,
    Local<Signature>(),
    0,
    ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect,
    fastCFunc
  );
  // TODO: figure out how to handle side-effect flag:
  // https://github.com/nodejs/node/pull/46619
  Local<Function> fun =
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}

`

const libs = ['ffi']
const includes = ['ffi.h']
const name = 'libffi'
const obj = []
const include_paths = []

const mac = {
  include_paths: ['libffi/include'],
  lib_paths: ['libffi/lib'],
  prefix: '/usr/local/opt/'
}

export { api, includes, name, preamble, libs, obj, include_paths, mac }
