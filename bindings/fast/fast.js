const api = {
  bind_fastcall: {
    declare_only: true,
    nofast: true
  },
  fastcall: {
    parameters: ['pointer'],
    pointers: ['struct fastcall*'],
    result: 'void',
    name: 'spin_fastcall'
  }
}

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

*/

struct fastcall {
  void* wrapper;
  uint8_t result;
  uint8_t nparam;
  uint8_t param[30];
  uint64_t reg[16];
  void* sse[16];
  void* stack;
};

typedef void (*spin_fast_call)(void*);

inline uint8_t needsunwrap (spin::FastTypes t) {
  if (t == spin::FastTypes::buffer) return 1;
  if (t == spin::FastTypes::u32array) return 1;
  if (t == spin::FastTypes::pointer) return 1;
  if (t == spin::FastTypes::u64) return 1;
  if (t == spin::FastTypes::i64) return 1;
  return 0;
}

v8::CTypeInfo* CTypeFromV8 (uint8_t v8Type) {
  if (v8Type == spin::FastTypes::boolean) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kBool);
  if (v8Type == spin::FastTypes::i8) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  if (v8Type == spin::FastTypes::i16) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  if (v8Type == spin::FastTypes::i32) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  if (v8Type == spin::FastTypes::u8) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  if (v8Type == spin::FastTypes::u16) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  if (v8Type == spin::FastTypes::u32) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  if (v8Type == spin::FastTypes::f32) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kFloat32);
  if (v8Type == spin::FastTypes::f64) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kFloat64);
  if (v8Type == spin::FastTypes::i64) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt64);
  if (v8Type == spin::FastTypes::u64) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == spin::FastTypes::iSize) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt64);
  if (v8Type == spin::FastTypes::uSize) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == spin::FastTypes::pointer) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == spin::FastTypes::function) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == spin::FastTypes::string) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kSeqOneByteString);
  if (v8Type == spin::FastTypes::buffer) {
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint8, 
      v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  }
  if (v8Type == spin::FastTypes::u32array) {
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, 
      v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  }
  return new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);  
}

void spin_fastcall (struct fastcall* state) {
  ((spin_fast_call)state->reg[8])(&state->reg);
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
          state->reg[r++] = (uint64_t)strdup(*arg0);
        }
        break;
      case FastTypes::u32:
        state->reg[r++] = (uint32_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::u16:
        state->reg[r++] = (uint16_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::u8:
        state->reg[r++] = (uint8_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i32:
        state->reg[r++] = (int32_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i16:
        state->reg[r++] = (int16_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i8:
        state->reg[r++] = (int8_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i64:
        state->reg[r++] = (int64_t)Local<Number>::Cast(args[i])->Value();
        break;
      case FastTypes::u64:
      case FastTypes::pointer:
        state->reg[r++] = (uint64_t)Local<Number>::Cast(args[i])->Value();
        break;
      case FastTypes::buffer:
        {
          Local<Uint8Array> u8 = args[i].As<Uint8Array>();
          state->reg[r++] = (uint64_t)((uint8_t*)u8->Buffer()->Data() + u8->ByteOffset());
        }
        break;
      case FastTypes::u32array:
        {
          Local<Uint32Array> u32 = args[i].As<Uint32Array>();
          state->reg[r++] = (uint64_t)((uint8_t*)u32->Buffer()->Data() + u32->ByteOffset());
        }
        break;
    }
  }
  spin_fastcall(state);
  switch (state->result) {
    case FastTypes::i32:
      args.GetReturnValue().Set((int32_t)state->reg[0]);
      break;
    case FastTypes::u32:
      args.GetReturnValue().Set((uint32_t)state->reg[0]);
      break;
    case FastTypes::buffer:
    case FastTypes::u32array:
    case FastTypes::u64:
    case FastTypes::i64:
    case FastTypes::pointer:
      uint64_t* res = (uint64_t*)args[args.Length() - 1].As<Uint32Array>()->Buffer()->Data();
      *res = state->reg[0];
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

`

const name = 'fast'

export { name, api, preamble }
