const api = {
  calloc: {
    parameters: ['u32', 'u32'],
    result: 'pointer'
  },
  read: {
    parameters: ['i32', 'pointer', 'i32'],
    result: 'i32',
    name: '_read'
  },
  write: {
    parameters: ['i32', 'pointer', 'i32'],
    result: 'i32',
    name: '_write'
  },
  write_string: {
    parameters: ['i32', 'string', 'i32'],
    pointers: [, 'const char*'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }],
    result: 'i32',
    name: '_write'
  },
  putchar: {
    parameters: ['i32'],
    result: 'i32'
  },
  getchar: {
    parameters: [],
    result: 'i32'
  },
  close: {
    parameters: ['i32'],
    result: 'i32',
    name: '_close'
  },
  lseek: {
    parameters: ['i32', 'u32', 'i32'],
    result: 'u32',
    name: '_lseek'
  },
  // https://github.com/wine-mirror/wine/blob/master/include/msvcrt/sys/stat.h#L52
  fstat: {
    parameters: ['i32', 'pointer'],
    pointers: [, 'struct _stat *'],
    result: 'i32',
    name: '_fstat'
  },
  rename: {
    parameters: ['string', 'string'],
    result: 'i32'
  },
  open: {
    parameters: ['string', 'i32', 'i32'],
    pointers: ['const char*'],
    result: 'i32',
    name: '_open'
  },
  unlink: {
    parameters: ['string'],
    result: 'i32',
    name: '_unlink'
  },
  memcpy: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  memset: {
    parameters: ['pointer', 'i32', 'u32'],
    result: 'pointer'
  },
  memmove: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  malloc: {
    parameters: ['u32'],
    result: 'pointer'
  },
  realloc: {
    parameters: ['pointer', 'u32'],
    result: 'pointer'
  },
  aligned_alloc: {
    parameters: ['u32', 'u32'],
    result: 'pointer',
    name: '_aligned_malloc'
  },
  free: {
    parameters: ['pointer'],
    result: 'void'
  },
  bind_fastcall: {
    declare_only: true,
    nofast: true
  },
  bind_slowcall: {
    declare_only: true,
    nofast: true
  },
  fastcall: {
    parameters: ['pointer'],
    pointers: ['struct fastcall*'],
    result: 'void',
    name: 'lo_fastcall'
  },
  getenv: {
    parameters: ['string'],
    pointers: ['const char*'],
    rpointer: 'char*',
    result: 'pointer'
  },
  dup: {
    parameters: ['i32'],
    result: 'i32',
    name: '_dup'
  },
  dup2: {
    parameters: ['i32', 'i32'],
    result: 'i32',
    name: '_dup2'
  },
  getcwd: {
    parameters: ['pointer', 'i32'],
    pointers: ['char*'],
    result: 'pointer',
    name: '_getcwd'
  },
  getpid: {
    parameters: [],
    result: 'i32',
    name: '_getpid'
  },
  execve: {
    parameters: ['string', 'buffer', 'buffer'],
    pointers: ['const char*', 'char* const*', 'char* const*'],
    result: 'i32',
    name: '_execve'
  },
  execvp: {
    parameters: ['string', 'buffer'],
    pointers: ['const char*', 'char* const*'],
    result: 'i32',
    name: '_execvp'
  },
  exit: {
    parameters: ['i32'],
    result: 'void'
  },
  isolate_create: {
    parameters: [
      'i32', 'u32array', 'string', 'u32', 'string', 'u32', 'buffer',
      'i32', 'i32', 'u64', 'string', 'string', 'i32', 'i32', 'pointer'
    ],
    pointers: [
      , 'char**', 'const char*', , 'const char*', , 'char*', , ,
      'const char*', 'const char*'
    ],
    result: 'i32',
    name: 'lo_create_isolate',
    jsdoc: ``,
    nofast: true
  },
  isolate_context_create: {
    parameters: [
      'i32', 'pointer', 'string', 'u32', 'string', 'u32', 'pointer',
      'i32', 'i32', 'u64', 'string', 'string', 'i32', 'i32', 'pointer', 'buffer'
    ],
    pointers: [
      , 'char**', 'const char*', , 'const char*', , 'char*', , ,
      'const char*', 'const char*', , , , , 'struct isolate_context*'
    ],
    result: 'void',
    name: 'lo_create_isolate_context',
    nofast: true
  },
  isolate_context_destroy: {
    parameters: ['buffer'],
    pointers: ['struct isolate_context*'],
    result: 'void',
    name: 'lo_destroy_isolate_context'
  },
  isolate_context_size: {
    parameters: [],
    result: 'i32',
    name: 'lo_context_size'
  },
  isolate_start: {
    parameters: ['buffer'],
    result: 'void',
    name: 'lo_start_isolate',
    nofast: true
  },
  callback: {
    parameters: ['pointer'],
    pointers: ['exec_info*'],
    result: 'void',
    name: 'lo_callback',
    nofast: true
  },
  strnlen: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'u32'
  },
  isatty: {
    parameters: ['i32'],
    result: 'i32',
    name: '_isatty'
  },
}

const preamble = `
struct fastcall {
  void* wrapper;      // 0-7   :   v8 fastcall wrapper function pointer
  uint8_t result;     // 8     :   the type of the result
  uint8_t nparam;     // 9     :   the number of args (max 255) 
  uint8_t param[30];  // 10-39 :   an array of types of the arguments
  uint64_t args[32];  // 40-295:   an array of pointer slots for arguments
                      // these will be filled in dynamically by 
                      // lo::core::SlowCallback for the slow call
                      // and then the slowcall wrapper will shift them from
                      // this structure into regs + stack and make the call
                      // the first slot is reserved for the result
  void* fn;           // 296-303:  the slowcall wrapper function pointer
};

typedef void (*lo_fast_call)(void*);

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
  if (v8Type == lo::FastTypes::buffer)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == lo::FastTypes::u32array)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  return new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
}

void lo_fastcall (struct fastcall* state) {
  ((lo_fast_call)state->fn)(&state->args);
}

void SlowCallback(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  struct fastcall* state = (struct fastcall*)args.Data()
    .As<Object>()->GetAlignedPointerFromInternalField(1);
  int r = 1;
  int s = 0;
  char* temp_strs[100];
  for (int i = 0; i < state->nparam; i++) {
    switch (state->param[i]) {
      case FastTypes::string:
        {
          String::Utf8Value arg0(isolate, args[i]);
          temp_strs[s] = strdup(*arg0);
          state->args[r++] = (uint64_t)temp_strs[s++];
        }
        break;
      case FastTypes::u32:
        state->args[r++] = (uint32_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::u16:
        state->args[r++] = (uint16_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::u8:
        state->args[r++] = (uint8_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::boolean:
        state->args[r++] = (bool)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i32:
        state->args[r++] = (int32_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i16:
        state->args[r++] = (int16_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i8:
        state->args[r++] = (int8_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i64:
      case FastTypes::iSize:
        state->args[r++] = (int64_t)Local<Number>::Cast(args[i])->Value();
        break;
      case FastTypes::u64:
      case FastTypes::pointer:
      case FastTypes::uSize:
        state->args[r++] = (uint64_t)Local<Number>::Cast(args[i])->Value();
        break;
      case FastTypes::buffer:
        {
          Local<Uint8Array> u8 = args[i].As<Uint8Array>();
          state->args[r++] = (uint64_t)((uint8_t*)u8->Buffer()->Data() +
            u8->ByteOffset());
        }
        break;
      case FastTypes::u32array:
        {
          Local<Uint32Array> u32 = args[i].As<Uint32Array>();
          state->args[r++] = (uint64_t)((uint8_t*)u32->Buffer()->Data() +
            u32->ByteOffset());
        }
        break;
      case FastTypes::function:
        break;
      case FastTypes::f32:
        {
          float src = (float)args[i].As<v8::Number>()->Value();
          float* dst = (float*)&state->args[r++];
          *dst = src;
        }
        break;
      case FastTypes::f64:
        {
          double src = (double)args[i].As<v8::Number>()->Value();
          double* dst = (double*)&state->args[r++];
          *dst = src;
        }
        break;
    }
  }
  lo_fastcall(state);
  for (int i = 0; i < s; i++) {
    free(temp_strs[i]);
  }
  switch (state->result) {
    case FastTypes::i32:
      args.GetReturnValue().Set((int32_t)state->args[0]);
      break;
    case FastTypes::u32:
      args.GetReturnValue().Set((uint32_t)state->args[0]);
      break;
    case FastTypes::boolean:
      args.GetReturnValue().Set((bool)state->args[0]);
      break;
    case FastTypes::f32:
      {
        float* dst = (float*)&state->args[0];
        args.GetReturnValue().Set(Number::New(isolate, *dst));
      }
      break;
    case FastTypes::f64:
      {
        double* dst = (double*)&state->args[0];
        args.GetReturnValue().Set(Number::New(isolate, *dst));
      }
      break;
    case FastTypes::i64:
      {
        int64_t* res = reinterpret_cast<int64_t*>((uint64_t)Local<Integer>::Cast(args[args.Length() - 1])->Value());
        *res = state->args[0];
      }
      break;
    case FastTypes::buffer:
    case FastTypes::u32array:
    case FastTypes::u64:
    case FastTypes::pointer:
      {
        uint64_t* res = reinterpret_cast<uint64_t*>((uint64_t)Local<Integer>::Cast(args[args.Length() - 1])->Value());
        *res = state->args[0];
      }
      break;
  }
}

void bind_fastcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  // TODO - does integer work?
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
    Local<Integer>::Cast(args[0])->Value());
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
  data->SetAlignedPointerInInternalField(1, state);
  uint8_t unwrap = needsunwrap((FastTypes)state->result);
  int fastlen = state->nparam + 1 + unwrap;
  CTypeInfo* cargs = (CTypeInfo*)calloc(fastlen, sizeof(CTypeInfo));
  cargs[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  for (int i = 0; i < state->nparam; i++) {
    uint8_t ptype = state->param[i];
    cargs[i + 1] = *CTypeFromV8(ptype);
  }
  CTypeInfo* rc;
  if (unwrap) {
    cargs[fastlen - 1] = *CTypeFromV8(FastTypes::u32array);
    rc = CTypeFromV8(FastTypes::empty);
  } else {
    rc = CTypeFromV8((FastTypes)state->result);
  }
  CFunctionInfo* info = new CFunctionInfo(*rc, fastlen, cargs);
  CFunction* fastCFunc = new CFunction(state->wrapper, info);
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(isolate,
    SlowCallback, data, Local<v8::Signature>(), 0, v8::ConstructorBehavior::kThrow,
    v8::SideEffectType::kHasNoSideEffect, fastCFunc
  );
  Local<Function> fun =
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}

void bind_slowcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
    Local<Integer>::Cast(args[0])->Value());
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
  data->SetAlignedPointerInInternalField(1, state);
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(isolate,
    SlowCallback, data, Local<v8::Signature>(), 0, v8::ConstructorBehavior::kThrow,
    v8::SideEffectType::kHasNoSideEffect, 0
  );
  Local<Function> fun =
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}
`
const includes = ['io.h', 'direct.h', 'process.h']
const name = 'core'
const libs = []
const obj = []
const constants = {
  S_IFCHR: 'i32', O_RDONLY: 'i32', O_WRONLY: 'i32', O_CREAT: 'i32', 
  O_TRUNC: 'i32', STDIN: 0, STDOUT: 1, STDERR: 2, SEEK_SET: 'i32', 
  SEEK_CUR: 'i32', SEEK_END: 'i32', S_IFMT: 'i32', S_IFDIR: 'i32',
  S_IFREG: 'i32', O_RDWR: 'i32', EAGAIN: 'i32',
  // WIN Specific
  _S_IREAD: 'i32',
  _S_IWRITE: 'i32',
  _O_APPEND: 'i32',
  _O_BINARY: 'i32',
  _O_CREAT: 'i32',
  _O_RDONLY: 'i32',
  _O_RDWR: 'i32',
  _O_TEXT: 'i32',
  _O_TRUNC: 'i32',
  _O_WRONLY: 'i32',
  _O_U16TEXT: 'i32',
  _O_U8TEXT: 'i32',
}

const structs = ['fastcall']

export {
  api, includes, name, libs, obj, constants, structs, preamble
}
