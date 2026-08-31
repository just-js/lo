// lo_ffi.cc — generic dlopen'd-FFI-call machinery (SlowCallback/
// bind_fastcallSlow/bind_slowcallSlow/CTypeFromV8/needsunwrap/
// lo_fastcall), declared in lo.h but deliberately its own translation
// unit, not part of lo.cc. See lo.h's own comment on why: lo.cc is
// unconditional in every runtime build, including runtime/zero.config.js's
// deliberately core-less, bindings-free build, and this file is compiled
// and linked only when a runtime config's bindings actually need it
// (lib/build.js's build_runtime, gated on 'core'/'core2' being present) —
// the same conditional-linking pattern this codebase already uses for
// musl-glibc-compat.o.
//
// Moved out of lib/core/api.js's own preamble, where it was originally
// hand-written directly ("a kind of experiment," per the user) —
// lib/core2/api.js had its own near-verbatim copy for the Windows build
// (WORK.md's E.7), now unnecessary since both resolve this from here
// instead. Nothing in this file is actually core-specific or even
// OS-specific — it's pure v8:: use, the same reason moving it here
// resolves E.7's duplication for free.

#include "lo.h"

#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
// Windows' CRT has no strdup, only _strdup -- lib/core2/api.js's own
// former copy of this file carried this same define for the same
// reason (real usage: SlowCallback's LO_STRING/FastTypes::string case).
#define strdup _strdup
#endif

using namespace v8;

uint8_t lo::needsunwrap (FastTypes t) {
  if (t == FastTypes::buffer) return 1;
  if (t == FastTypes::u32array) return 1;
  if (t == FastTypes::pointer) return 1;
  if (t == FastTypes::u64) return 1;
  if (t == FastTypes::i64) return 1;
  return 0;
}

CTypeInfo* lo::CTypeFromV8 (uint8_t v8Type) {
  if (v8Type == FastTypes::boolean)
    return new CTypeInfo(CTypeInfo::Type::kBool);
  if (v8Type == FastTypes::i8)
    return new CTypeInfo(CTypeInfo::Type::kInt32);
  if (v8Type == FastTypes::i16)
    return new CTypeInfo(CTypeInfo::Type::kInt32);
  if (v8Type == FastTypes::i32)
    return new CTypeInfo(CTypeInfo::Type::kInt32);
  if (v8Type == FastTypes::u8)
    return new CTypeInfo(CTypeInfo::Type::kUint32);
  if (v8Type == FastTypes::u16)
    return new CTypeInfo(CTypeInfo::Type::kUint32);
  if (v8Type == FastTypes::u32)
    return new CTypeInfo(CTypeInfo::Type::kUint32);
  if (v8Type == FastTypes::f32)
    return new CTypeInfo(CTypeInfo::Type::kFloat32);
  if (v8Type == FastTypes::f64)
    return new CTypeInfo(CTypeInfo::Type::kFloat64);
  if (v8Type == FastTypes::i64)
    return new CTypeInfo(CTypeInfo::Type::kInt64);
  if (v8Type == FastTypes::u64)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == FastTypes::iSize)
    return new CTypeInfo(CTypeInfo::Type::kInt64);
  if (v8Type == FastTypes::uSize)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == FastTypes::pointer)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == FastTypes::function)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == FastTypes::string)
    return new CTypeInfo(CTypeInfo::Type::kSeqOneByteString);
  if (v8Type == FastTypes::buffer)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == FastTypes::u32array)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  return new CTypeInfo(CTypeInfo::Type::kVoid);
}

void lo::lo_fastcall (struct fastcall* state) {
  ((lo_fast_call)state->fn)(&state->args);
}

void lo::SlowCallback(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
#if LO_V8_INTERNAL_FIELD_TAG
  struct fastcall* state = (struct fastcall*)args.Data()
    .As<Object>()->GetAlignedPointerFromInternalField(1, v8::kEmbedderDataTypeTagDefault);
#else
  struct fastcall* state = (struct fastcall*)args.Data()
    .As<Object>()->GetAlignedPointerFromInternalField(1);
#endif
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
          float src = (float)args[i].As<Number>()->Value();
          float* dst = (float*)&state->args[r++];
          *dst = src;
        }
        break;
      case FastTypes::f64:
        {
          double src = (double)args[i].As<Number>()->Value();
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

void lo::bind_fastcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  // TODO - does integer work?
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
    Local<Integer>::Cast(args[0])->Value());
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
#if LO_V8_INTERNAL_FIELD_TAG
  data->SetAlignedPointerInInternalField(1, state, v8::kEmbedderDataTypeTagDefault);
#else
  data->SetAlignedPointerInInternalField(1, state);
#endif
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

void lo::bind_slowcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
    Local<Integer>::Cast(args[0])->Value());
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
#if LO_V8_INTERNAL_FIELD_TAG
  data->SetAlignedPointerInInternalField(1, state, v8::kEmbedderDataTypeTagDefault);
#else
  data->SetAlignedPointerInInternalField(1, state);
#endif
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(isolate,
    SlowCallback, data, Local<Signature>(), 0, ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect, 0
  );
  Local<Function> fun =
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}
