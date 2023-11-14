const api = {
// dlopen
  dlopen: {
    parameters: ['string', 'i32'],
    pointers: ['const char*'],
    result: 'pointer'
  },
  dlsym: {
    parameters: ['pointer', 'string'],
    pointers: ['void*', 'const char*'],
    result: 'pointer'
  },
  dlclose: {
    parameters: ['pointer'],
    pointers: ['void*'],
    result: 'i32'
  },
// fs
  close: {
    parameters: ['i32'],
    result: 'i32'
  },
  open: {
    parameters: ['string', 'i32', 'i32'],
    pointers: ['const char*'],
    result: 'i32'
  },
  read: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  pread: {
    parameters: ['i32', 'buffer', 'i32', 'u32'],
    result: 'i32'
  },
  lseek: {
    parameters: ['i32', 'u32', 'i32'],
    result: 'u32'
  },
  write: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  fstat: {
    parameters: ['i32', 'buffer'],
    pointers: [, 'struct stat *'],
    result: 'i32'
  },
  unlink: {
    parameters: ['string'],
    result: 'i32'
  },
  readdir: {
    parameters: ['pointer'],
    result: 'pointer',
    pointers: ['DIR*'],
    rpointer: 'dirent*'
  },
  opendir: {
    parameters: ['string'],
    result: 'pointer',
    pointers: ['const char*'],
    rpointer: 'DIR*'
  },
  closedir: {
    parameters: ['pointer'],
    pointers: ['DIR*'],
    result: 'i32'
  },
  fcntl: {
    parameters: ['i32', 'i32', 'i32'],
    result: 'i32'
  },
// asm
  mprotect: {
    parameters: ['pointer', 'u32', 'i32'],
    result: 'i32'
  },
  memcpy: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  memmove: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
// fastcalls
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
  }

}

const constants = {
  S_IFBLK: 'i32', S_IFCHR: 'i32', S_IFIFO: 'i32', 
  S_IRUSR: 'i32', S_IWUSR: 'i32', S_IRGRP: 'i32', S_IWGRP: 'i32',
  S_IROTH: 'i32', S_IWOTH: 'i32'
}
const includes = [
  'unistd.h', 'sys/stat.h', 'fcntl.h', 'dirent.h', 'dlfcn.h', 'sys/mman.h'
]

const preamble = `
/*
caller
- generates machine code to call the C function
- generates machine code for the wrapper v8 fastcall wrapper
- creates a new instance of the fastcall struct
- calls bind_fastcall(struct) -> fn

- when you have created the struct you can populate it yourself and call 
  fast.fastcall(struct) to invoke it directly, or you can wrap it in a 
  fastcall using bind_fastcall


// https://wiki.cdot.senecacollege.ca/wiki/X86_64_Register_and_Instruction_Quick_Start

const gp = [      // general purpose registers (64 bit), (P) = preserve
  'rax',          // register a extended (out: return value, in: syscall_nr / 0)
  'rdi',          // register destination index (arg 1)
  'rsi',          // register source index      (arg 2)
  'rdx',          // register d extended        (arg 3)
  'rcx',          // register c extended        (arg 4)
  'r8',           // register 8                 (arg 5)
  'r9',           // register 9                 (arg 6)
  'rsp',          // register stack pointer (all other args on stack)    (P)
  'rbx',          // register b extended                                 (P)
  'rbp',          // register base pointer (base of stack)               (P)
  'r10',          // register 10
  'r11',          // register 11
  'r12',          // register 12                                         (P)
  'r13',          // register 13                                         (P)
  'r14',          // register 14                                         (P)
  'r15',          // register 15                                         (P)
]

const sse = [     // sse registers (128 bit)
  'xmm0', 'xmm1', 'xmm2',  'xmm3',  'xmm4',  'xmm5',  'xmm6',  'xmm7',
  'xmm8', 'xmm9', 'xmm10', 'xmm11', 'xmm12', 'xmm13', 'xmm14', 'xmm15' 
]

*/

struct fastcall {
  void* wrapper;
  uint8_t result;
  uint8_t nparam;
  uint8_t param[30];
  uint64_t args[32];
  void* fn;
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

void lo_fastcall (struct fastcall* state) {
  ((lo_fast_call)state->fn)(&state->args);
}

void SlowCallback(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  struct fastcall* state = (struct fastcall*)args.Data()
    .As<Object>()->GetAlignedPointerFromInternalField(1);
  int r = 1;
  for (int i = 0; i < state->nparam; i++) {
    switch (state->param[i]) {
      case FastTypes::string:
        {
          String::Utf8Value arg0(isolate, args[i]);
          // todo: fix this - never gets freed
          state->args[r++] = (uint64_t)strdup(*arg0);
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
          state->args[r++] = (uint64_t)((uint8_t*)u8->Buffer()->Data() + u8->ByteOffset());
        }
        break;
      case FastTypes::u32array:
        {
          Local<Uint32Array> u32 = args[i].As<Uint32Array>();
          state->args[r++] = (uint64_t)((uint8_t*)u32->Buffer()->Data() + u32->ByteOffset());
        }
        break;
      case FastTypes::function:
        break;
      case FastTypes::f32:
        break;
      case FastTypes::f64:
        break;
    }
  }
  lo_fastcall(state);
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
    case FastTypes::buffer:
    case FastTypes::u32array:
    case FastTypes::u64:
    case FastTypes::i64:
    case FastTypes::pointer:
      uint64_t* res = (uint64_t*)args[args.Length() - 1].As<Uint32Array>()->Buffer()->Data();
      *res = state->args[0];
      break;
  }
}

void bind_fastcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
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
    SlowCallback, data, Local<Signature>(), 0, ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect, fastCFunc
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
    SlowCallback, data, Local<Signature>(), 0, ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect, 0
  );

  //Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(isolate, 
  //  SlowCallback);
  Local<Function> fun = 
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}

`

const name = 'core'
const libs = ['dl']
const obj = []

export { api, includes, name, libs, obj, constants, preamble }

