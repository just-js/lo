
// [do not edit,<auto-generated />]
// This file has been automatically generated, please do not change unless you disable auto-generation in the Makefile  
#include <pthread.h>
#include <spin.h>

namespace spin {
namespace thread {

using v8::String;
using v8::FunctionCallbackInfo;
using v8::Array;
using v8::Local;
using v8::ObjectTemplate;
using v8::Isolate;
using v8::Value;
using v8::Uint32Array;
using v8::ArrayBuffer;
using v8::Context;
using v8::Integer;
using v8::Function;
using v8::NewStringType;
using v8::Object;
using v8::BackingStore;
using v8::TryCatch;
using v8::ScriptCompiler;
using v8::Module;
using v8::FixedArray;
using v8::ScriptOrigin;
using v8::SharedArrayBuffer;
using v8::MaybeLocal;
using v8::HandleScope;
using v8::Promise;
using v8::Number;
using v8::StackTrace;
using v8::Message;
using v8::StackFrame;
using v8::Maybe;
using v8::FunctionTemplate;
using v8::FunctionCallback;
using v8::PromiseRejectMessage;
using v8::CFunction;
using v8::Global;
using v8::Exception;
using v8::CTypeInfo;
using v8::PropertyAttribute;
using v8::Signature;
using v8::ConstructorBehavior;
using v8::SideEffectType;
using v8::kPromiseRejectAfterResolved;
using v8::kPromiseResolveAfterResolved;
using v8::kPromiseHandlerAddedAfterReject;
using v8::Data;
using v8::PrimitiveArray;
using v8::TypedArray;
using v8::Uint8Array;
using v8::Boolean;
using v8::ModuleRequest;
using v8::CFunctionInfo;
using v8::OOMDetails;
using v8::V8;

typedef void* (*start_routine)(void*);


void createSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Uint32Array> u320 = args[0].As<Uint32Array>();
  uint8_t* ptr0 = (uint8_t*)u320->Buffer()->Data() + u320->ByteOffset();
  pthread_t* v0 = reinterpret_cast<pthread_t*>(ptr0);
  const pthread_attr_t* v1 = reinterpret_cast<const pthread_attr_t*>((uint64_t)Local<Integer>::Cast(args[1])->Value());
  start_routine v2 = reinterpret_cast<start_routine>((uint64_t)Local<Integer>::Cast(args[2])->Value());
  Local<Uint8Array> u83 = args[3].As<Uint8Array>();
  uint8_t* ptr3 = (uint8_t*)u83->Buffer()->Data() + u83->ByteOffset();
  void* v3 = reinterpret_cast<void*>(ptr3);
  int32_t rc = pthread_create(v0, v1, v2, v3);
  args.GetReturnValue().Set(Number::New(isolate, rc));
}

int32_t createFast(void* p, struct FastApiTypedArray* const p0, void* p1, void* p2, struct FastApiTypedArray* const p3) {
  pthread_t* v0 = reinterpret_cast<pthread_t*>(p0->data);
  const pthread_attr_t* v1 = reinterpret_cast<const pthread_attr_t*>(p1);
  start_routine v2 = reinterpret_cast<start_routine>(p2);
  void* v3 = reinterpret_cast<void*>(p3->data);
  return pthread_create(v0, v1, v2, v3);
}
void cancelSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  uint64_t v0 = Local<Integer>::Cast(args[0])->Value();
  int32_t rc = pthread_cancel((pthread_t)v0);
  args.GetReturnValue().Set(Number::New(isolate, rc));
}

int32_t cancelFast(void* p, uint64_t p0) {
  uint64_t v0 = p0;
  return pthread_cancel((pthread_t)v0);
}
void selfSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();

  uint64_t rc = pthread_self();
  args.GetReturnValue().Set(Number::New(isolate, static_cast<uint64_t>(rc)));
}

void selfFast(void* p, struct FastApiTypedArray* const p_ret) {

  uint64_t r = pthread_self();
  ((uint64_t*)p_ret->data)[0] = r;

}
void detachSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  uint64_t v0 = Local<Integer>::Cast(args[0])->Value();
  int32_t rc = pthread_detach((pthread_t)v0);
  args.GetReturnValue().Set(Number::New(isolate, rc));
}

int32_t detachFast(void* p, uint64_t p0) {
  uint64_t v0 = p0;
  return pthread_detach((pthread_t)v0);
}
void joinSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  uint64_t v0 = Local<Integer>::Cast(args[0])->Value();
  Local<Uint32Array> u321 = args[1].As<Uint32Array>();
  uint8_t* ptr1 = (uint8_t*)u321->Buffer()->Data() + u321->ByteOffset();
  void** v1 = reinterpret_cast<void**>(ptr1);
  int32_t rc = pthread_join((pthread_t)v0, v1);
  args.GetReturnValue().Set(Number::New(isolate, rc));
}

int32_t joinFast(void* p, uint64_t p0, struct FastApiTypedArray* const p1) {
  uint64_t v0 = p0;
  void** v1 = reinterpret_cast<void**>(p1->data);
  return pthread_join((pthread_t)v0, v1);
}
void exitSlow(const FunctionCallbackInfo<Value> &args) {
  Local<Uint32Array> u320 = args[0].As<Uint32Array>();
  uint8_t* ptr0 = (uint8_t*)u320->Buffer()->Data() + u320->ByteOffset();
  void* v0 = reinterpret_cast<void*>(ptr0);
  pthread_exit(v0);
}

void exitFast(void* p, struct FastApiTypedArray* const p0) {
  void* v0 = reinterpret_cast<void*>(p0->data);
  pthread_exit(v0);
}
void tryJoinSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  uint64_t v0 = Local<Integer>::Cast(args[0])->Value();
  Local<Uint32Array> u321 = args[1].As<Uint32Array>();
  uint8_t* ptr1 = (uint8_t*)u321->Buffer()->Data() + u321->ByteOffset();
  void** v1 = reinterpret_cast<void**>(ptr1);
  int32_t rc = pthread_tryjoin_np((pthread_t)v0, v1);
  args.GetReturnValue().Set(Number::New(isolate, rc));
}

int32_t tryJoinFast(void* p, uint64_t p0, struct FastApiTypedArray* const p1) {
  uint64_t v0 = p0;
  void** v1 = reinterpret_cast<void**>(p1->data);
  return pthread_tryjoin_np((pthread_t)v0, v1);
}
void setNameSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  uint64_t v0 = Local<Integer>::Cast(args[0])->Value();
  String::Utf8Value v1(isolate, args[1]);
  int32_t rc = pthread_setname_np((pthread_t)v0, *v1);
  args.GetReturnValue().Set(Number::New(isolate, rc));
}

int32_t setNameFast(void* p, uint64_t p0, struct FastOneByteString* const p1) {
  uint64_t v0 = p0;
  struct FastOneByteString* const v1 = p1;
  return pthread_setname_np((pthread_t)v0, v1->data);
}
void setAffinitySlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  uint64_t v0 = Local<Integer>::Cast(args[0])->Value();
  uint32_t v1 = Local<Integer>::Cast(args[1])->Value();
  Local<Uint8Array> u82 = args[2].As<Uint8Array>();
  uint8_t* ptr2 = (uint8_t*)u82->Buffer()->Data() + u82->ByteOffset();
  cpu_set_t* v2 = reinterpret_cast<cpu_set_t*>(ptr2);
  int32_t rc = pthread_setaffinity_np((pthread_t)v0, v1, v2);
  args.GetReturnValue().Set(Number::New(isolate, rc));
}

int32_t setAffinityFast(void* p, uint64_t p0, uint32_t p1, struct FastApiTypedArray* const p2) {
  uint64_t v0 = p0;
  uint32_t v1 = p1;
  cpu_set_t* v2 = reinterpret_cast<cpu_set_t*>(p2->data);
  return pthread_setaffinity_np((pthread_t)v0, v1, v2);
}
void getAffinitySlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  uint64_t v0 = Local<Integer>::Cast(args[0])->Value();
  uint32_t v1 = Local<Integer>::Cast(args[1])->Value();
  Local<Uint8Array> u82 = args[2].As<Uint8Array>();
  uint8_t* ptr2 = (uint8_t*)u82->Buffer()->Data() + u82->ByteOffset();
  cpu_set_t* v2 = reinterpret_cast<cpu_set_t*>(ptr2);
  int32_t rc = pthread_getaffinity_np((pthread_t)v0, v1, v2);
  args.GetReturnValue().Set(Number::New(isolate, rc));
}

int32_t getAffinityFast(void* p, uint64_t p0, uint32_t p1, struct FastApiTypedArray* const p2) {
  uint64_t v0 = p0;
  uint32_t v1 = p1;
  cpu_set_t* v2 = reinterpret_cast<cpu_set_t*>(p2->data);
  return pthread_getaffinity_np((pthread_t)v0, v1, v2);
}

void Init(Isolate* isolate, Local<ObjectTemplate> target) {
  Local<ObjectTemplate> module = ObjectTemplate::New(isolate);

  v8::CTypeInfo* cargscreate = (v8::CTypeInfo*)calloc(5, sizeof(v8::CTypeInfo));
  cargscreate[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargscreate[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  cargscreate[2] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  cargscreate[3] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  cargscreate[4] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint8, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  v8::CTypeInfo* rccreate = new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CFunctionInfo* infocreate = new v8::CFunctionInfo(*rccreate, 5, cargscreate);
  v8::CFunction* pFcreate = new v8::CFunction((const void*)&createFast, infocreate);
  SET_FAST_METHOD(isolate, module, "create", pFcreate, createSlow);

  v8::CTypeInfo* cargscancel = (v8::CTypeInfo*)calloc(2, sizeof(v8::CTypeInfo));
  cargscancel[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargscancel[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  v8::CTypeInfo* rccancel = new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CFunctionInfo* infocancel = new v8::CFunctionInfo(*rccancel, 2, cargscancel);
  v8::CFunction* pFcancel = new v8::CFunction((const void*)&cancelFast, infocancel);
  SET_FAST_METHOD(isolate, module, "cancel", pFcancel, cancelSlow);
  v8::CTypeInfo* cargsself = (v8::CTypeInfo*)calloc(2, sizeof(v8::CTypeInfo));
  cargsself[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);

  cargsself[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  v8::CTypeInfo* rcself = new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
  v8::CFunctionInfo* infoself = new v8::CFunctionInfo(*rcself, 2, cargsself);
  v8::CFunction* pFself = new v8::CFunction((const void*)&selfFast, infoself);
  SET_FAST_METHOD(isolate, module, "self", pFself, selfSlow);

  v8::CTypeInfo* cargsdetach = (v8::CTypeInfo*)calloc(2, sizeof(v8::CTypeInfo));
  cargsdetach[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargsdetach[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  v8::CTypeInfo* rcdetach = new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CFunctionInfo* infodetach = new v8::CFunctionInfo(*rcdetach, 2, cargsdetach);
  v8::CFunction* pFdetach = new v8::CFunction((const void*)&detachFast, infodetach);
  SET_FAST_METHOD(isolate, module, "detach", pFdetach, detachSlow);

  v8::CTypeInfo* cargsjoin = (v8::CTypeInfo*)calloc(3, sizeof(v8::CTypeInfo));
  cargsjoin[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargsjoin[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  cargsjoin[2] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  v8::CTypeInfo* rcjoin = new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CFunctionInfo* infojoin = new v8::CFunctionInfo(*rcjoin, 3, cargsjoin);
  v8::CFunction* pFjoin = new v8::CFunction((const void*)&joinFast, infojoin);
  SET_FAST_METHOD(isolate, module, "join", pFjoin, joinSlow);

  v8::CTypeInfo* cargsexit = (v8::CTypeInfo*)calloc(2, sizeof(v8::CTypeInfo));
  cargsexit[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargsexit[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  v8::CTypeInfo* rcexit = new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
  v8::CFunctionInfo* infoexit = new v8::CFunctionInfo(*rcexit, 2, cargsexit);
  v8::CFunction* pFexit = new v8::CFunction((const void*)&exitFast, infoexit);
  SET_FAST_METHOD(isolate, module, "exit", pFexit, exitSlow);

  v8::CTypeInfo* cargstryJoin = (v8::CTypeInfo*)calloc(3, sizeof(v8::CTypeInfo));
  cargstryJoin[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargstryJoin[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  cargstryJoin[2] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  v8::CTypeInfo* rctryJoin = new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CFunctionInfo* infotryJoin = new v8::CFunctionInfo(*rctryJoin, 3, cargstryJoin);
  v8::CFunction* pFtryJoin = new v8::CFunction((const void*)&tryJoinFast, infotryJoin);
  SET_FAST_METHOD(isolate, module, "tryJoin", pFtryJoin, tryJoinSlow);

  v8::CTypeInfo* cargssetName = (v8::CTypeInfo*)calloc(3, sizeof(v8::CTypeInfo));
  cargssetName[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargssetName[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  cargssetName[2] = v8::CTypeInfo(v8::CTypeInfo::Type::kSeqOneByteString);
  v8::CTypeInfo* rcsetName = new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CFunctionInfo* infosetName = new v8::CFunctionInfo(*rcsetName, 3, cargssetName);
  v8::CFunction* pFsetName = new v8::CFunction((const void*)&setNameFast, infosetName);
  SET_FAST_METHOD(isolate, module, "setName", pFsetName, setNameSlow);

  v8::CTypeInfo* cargssetAffinity = (v8::CTypeInfo*)calloc(4, sizeof(v8::CTypeInfo));
  cargssetAffinity[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargssetAffinity[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  cargssetAffinity[2] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  cargssetAffinity[3] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint8, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  v8::CTypeInfo* rcsetAffinity = new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CFunctionInfo* infosetAffinity = new v8::CFunctionInfo(*rcsetAffinity, 4, cargssetAffinity);
  v8::CFunction* pFsetAffinity = new v8::CFunction((const void*)&setAffinityFast, infosetAffinity);
  SET_FAST_METHOD(isolate, module, "setAffinity", pFsetAffinity, setAffinitySlow);

  v8::CTypeInfo* cargsgetAffinity = (v8::CTypeInfo*)calloc(4, sizeof(v8::CTypeInfo));
  cargsgetAffinity[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargsgetAffinity[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  cargsgetAffinity[2] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  cargsgetAffinity[3] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint8, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  v8::CTypeInfo* rcgetAffinity = new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CFunctionInfo* infogetAffinity = new v8::CFunctionInfo(*rcgetAffinity, 4, cargsgetAffinity);
  v8::CFunction* pFgetAffinity = new v8::CFunction((const void*)&getAffinityFast, infogetAffinity);
  SET_FAST_METHOD(isolate, module, "getAffinity", pFgetAffinity, getAffinitySlow);

  SET_MODULE(isolate, target, "thread", module);
}
} // namespace thread
} // namespace spin

extern "C" {
  void* _register_thread() {
    return (void*)spin::thread::Init;
  }
}