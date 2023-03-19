#pragma once

#include <v8.h>
#include <libplatform/libplatform.h>
#include <map>
#include <v8-fast-api-calls.h>

#ifdef __cplusplus
extern "C"
    {
#endif
    extern 
    int __xpg_strerror_r(int errcode,char* buffer,size_t length);
    #define strerror_r __xpg_strerror_r

#ifdef __cplusplus
    }
#endif

namespace spin {

using v8::String;
using v8::NewStringType;
using v8::Local;
using v8::Isolate;
using v8::Context;
using v8::ObjectTemplate;
using v8::FunctionCallbackInfo;
using v8::Function;
using v8::Object;
using v8::Value;
using v8::Module;
using v8::TryCatch;
using v8::Message;
using v8::StackTrace;
using v8::StackFrame;
using v8::HandleScope;
using v8::Integer;
using v8::BigInt;
using v8::FunctionTemplate;
using v8::ScriptOrigin;
using v8::True;
using v8::False;
using v8::ScriptCompiler;
using v8::ArrayBuffer;
using v8::Array;
using v8::Maybe;
using v8::HeapStatistics;
using v8::Float64Array;
using v8::HeapSpaceStatistics;
using v8::BigUint64Array;
using v8::Int32Array;
using v8::Exception;
using v8::FunctionCallback;
using v8::Script;
using v8::Platform;
using v8::V8;
using v8::BackingStore;
using v8::SharedArrayBuffer;
using v8::PromiseRejectMessage;
using v8::Promise;
using v8::PromiseRejectEvent;
using v8::Uint32Array;
using v8::BigUint64Array;
using v8::FixedArray;
using v8::Number;
using v8::PrimitiveArray;
using v8::FunctionCallbackInfo;
using v8::ObjectTemplate;
using v8::CFunction;
using v8::PropertyAttribute;
using v8::Signature;
using v8::ConstructorBehavior;
using v8::SideEffectType;
using v8::kPromiseRejectAfterResolved;
using v8::MaybeLocal;
using v8::kPromiseResolveAfterResolved;
using v8::kPromiseHandlerAddedAfterReject;
using v8::CTypeInfo;
using v8::CFunctionInfo;
using v8::V8;
using v8::Context;
using v8::Data;
using v8::Global;

// struct for passing typed arrays in and out of v8 fast api calls
struct FastApiTypedArray {
  uintptr_t length_;
  void* data;
};

// struct for builtin JS and text files that have been linked into the runtime
struct builtin {
  unsigned int size;
  const char* source;
};

// enum for types of JS that can be loaded/compiled by v8 platform
enum ScriptType : int {
  kScript,
  kModule,
  kFunction,
};

// struct used for passing options to V8 compiler when initialising modules
enum HostDefinedOptions : int {
  kType = 8,
  kID = 9,
  kLength = 10,
};

// typedef and V8 callback for module registration
typedef void *(*register_plugin)();
using InitializerCallback = void (*)(Isolate* isolate, 
  Local<ObjectTemplate> exports);

// maps for storing builtins (JS/Text) and modules (JS/C++ apis)
extern std::map<std::string, builtin*> builtins;
extern std::map<std::string, register_plugin> modules;
extern std::map<int, v8::Global<v8::Module>> module_map;

// struct to store callbacks for FFI bindings to fast api
struct foreignFunction {
  Global<Function> callback;
  void* fast;
  CFunction* cfunc;
};

// v8 callbacks
// callback for heap limit reached
size_t nearHeapLimitCallback(void* data, size_t current_heap_limit,

                                         size_t initial_heap_limit);
// declare the callback function for loading ES modules
MaybeLocal<Module> OnModuleInstantiate(Local<Context> context,
  Local<String> specifier, Local<FixedArray> import_assertions, 
  Local<Module> referrer);

// enum of v8 fast api parameter and return types
enum FastTypes: int {
  i8 = 1, i16 = 2, i32 = 3, u8 = 4, u16 = 5, u32 = 6, empty = 7, f32 = 8,
  f64 = 9, u64 = 10, i64 = 11, iSize = 12, uSize = 13, pointer = 14,
  buffer = 15, function = 16, u32array = 17, boolean = 18
};

// helpers for adding properties and methods to JS object templates
void SET_PROP(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, FunctionCallback getter,
  FunctionCallback setter);
void SET_METHOD(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, FunctionCallback callback);
void SET_MODULE(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, Local<ObjectTemplate> module);
void SET_VALUE(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, Local<Value> value);
void SET_FAST_METHOD(Isolate* isolate, Local<ObjectTemplate> exports, 
  const char * name, v8::CFunction* fastCFunc, FunctionCallback slowFunc);
void SET_FAST_PROP(Isolate* isolate, Local<ObjectTemplate> exports, 
  const char * name, v8::CFunction* fastGetter, FunctionCallback slowGetter,
  v8::CFunction* fastSetter, FunctionCallback slowSetter);

// internal API - on the spin:: namespace so can be used from other modules
uint64_t hrtime();
void builtins_add (const char* name, const char* source, 
  unsigned int size);
int CreateIsolate(int argc, char** argv, 
  const char* main, unsigned int main_len,
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname,
  int cleanup, int onexit);
int CreateIsolate(int argc, char** argv,
  const char* main, unsigned int main_len, uint64_t start,
  const char* globalobj, int cleanup, int onexit);
void PrintStackTrace(Isolate* isolate, const TryCatch& try_catch);
void PromiseRejectCallback(PromiseRejectMessage message);
void FreeMemory(void* buf, size_t length, void* data);

// external JS api - these are bound to the "spin" object on JS global
void Print(const FunctionCallbackInfo<Value> &args);
void Error(const FunctionCallbackInfo<Value> &args);

void LoadModule(const FunctionCallbackInfo<Value> &args);
void EvaluateModule(const FunctionCallbackInfo<Value> &args);
void SetModuleCallbacks(const FunctionCallbackInfo<Value> &args);

void Builtins(const FunctionCallbackInfo<Value> &args);
void Modules(const FunctionCallbackInfo<Value> &args);
void Builtin(const FunctionCallbackInfo<Value> &args);
void Library(const FunctionCallbackInfo<Value> &args);
void BindFastApi(const FunctionCallbackInfo<Value> &args);

void NextTick(const FunctionCallbackInfo<Value> &args);
void RunMicroTasks(const FunctionCallbackInfo<Value> &args);

void ReadMemory(const FunctionCallbackInfo<Value> &args);

void Utf8Length(const FunctionCallbackInfo<Value> &args);
void Utf8Encode(const FunctionCallbackInfo<Value> &args);
void Utf8Decode(const FunctionCallbackInfo<Value> &args);

// these can be fast api calls as they don't interact with JS heap
void GetErrno(const FunctionCallbackInfo<Value> &args);
int fastGetErrno(void* p);
void SetErrno(const FunctionCallbackInfo<Value> &args);
void fastSetErrno (void* p, int32_t e);

void HRTime(const FunctionCallbackInfo<Value> &args);
void fastHRTime (void* p, struct FastApiTypedArray* const p_ret);

void GetAddress(const FunctionCallbackInfo<Value> &args);
void fastGetAddress(void* p, struct FastApiTypedArray* const p_buf, 
  struct FastApiTypedArray* const p_ret);

// Module Initialization
void Init(Isolate* isolate, Local<ObjectTemplate> target);
}
