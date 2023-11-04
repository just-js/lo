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

class SpecialArrayBufferAllocator : public v8::ArrayBuffer::Allocator {
 public:
  void* Allocate(size_t length) override { 
    return calloc(length, 1); 
  }

  void* AllocateUninitialized(size_t length) override {
    return malloc(length);
  }

  void Free(void* data, size_t) override { free(data); }

  void* Reallocate(void* data, size_t old_length, size_t new_length) override {
    void* new_data = realloc(data, new_length);
    if (new_length > old_length) {
      memset(reinterpret_cast<uint8_t*>(new_data) + old_length, 0,
             new_length - old_length);
    }
    return new_data;
  }
};

// structs for passing typed arrays & strings in and out of v8 fast api calls
struct FastApiTypedArray {
  uintptr_t length_;
  void* data;
};

struct FastOneByteString {
  const char* data;
  uint32_t length;
};

struct FastApiArrayBuffer {
  void* data;
  size_t byte_length;
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

// enum used for passing options to V8 compiler when initialising modules
enum HostDefinedOptions : int {
  kType = 8,
  kID = 9,
  kLength = 10,
};

// typedef and V8 callback for module registration
typedef void *(*register_plugin)();
using InitializerCallback = void (*)(v8::Isolate* isolate, 
  v8::Local<v8::ObjectTemplate> exports);

// enum of v8 fast api parameter and return types
enum FastTypes: int {
  i8 = 1, i16 = 2, i32 = 3, u8 = 4, u16 = 5, u32 = 6, empty = 7, f32 = 8,
  f64 = 9, u64 = 10, i64 = 11, iSize = 12, uSize = 13, pointer = 14,
  buffer = 15, function = 16, u32array = 17, boolean = 18, string = 19
};

// v8 callbacks
// callback for heap limit reached
size_t nearHeapLimitCallback(void* data, size_t current_heap_limit,
  size_t initial_heap_limit);

// declare the callback function for loading ES modules
v8::MaybeLocal<v8::Module> OnModuleInstantiate(v8::Local<v8::Context> context,
  v8::Local<v8::String> specifier, v8::Local<v8::FixedArray> import_assertions, 
  v8::Local<v8::Module> referrer);

// helpers for adding properties and methods to JS object templates
void SET_PROP(v8::Isolate *isolate, v8::Local<v8::ObjectTemplate> 
  recv, const char *name, v8::FunctionCallback getter,
  v8::FunctionCallback setter);
void SET_METHOD(v8::Isolate *isolate, v8::Local<v8::ObjectTemplate> 
  recv, const char *name, v8::FunctionCallback callback);
void SET_MODULE(v8::Isolate *isolate, v8::Local<v8::ObjectTemplate> 
  recv, const char *name, v8::Local<v8::ObjectTemplate> module);
void SET_VALUE(v8::Isolate *isolate, v8::Local<v8::ObjectTemplate> 
  recv, const char *name, v8::Local<v8::Value> value);
void SET_FAST_METHOD(v8::Isolate* isolate, v8::Local<v8::ObjectTemplate> exports, 
  const char * name, v8::CFunction* fastCFunc, v8::FunctionCallback slowFunc);
void SET_FAST_PROP(v8::Isolate* isolate, v8::Local<v8::ObjectTemplate> exports, 
  const char * name, v8::CFunction* fastGetter, v8::FunctionCallback slowGetter,
  v8::CFunction* fastSetter, v8::FunctionCallback slowSetter);

// internal API - on the spin:: namespace so can be used from other modules
uint64_t hrtime();
void builtins_add (const char* name, const char* source, 
  unsigned int size);
void modules_add (const char* name, register_plugin plugin_handler);
int CreateIsolate(int argc, char** argv, 
  const char* main, unsigned int main_len,
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname,
  int cleanup, int onexit, const v8::StartupData* startup_data);
int CreateIsolate(int argc, char** argv,
  const char* main, unsigned int main_len, uint64_t start,
  const char* globalobj, int cleanup, int onexit, const v8::StartupData* startup_data);
void PrintStackTrace(v8::Isolate* isolate, const v8::TryCatch& try_catch);
void PromiseRejectCallback(v8::PromiseRejectMessage message);
void FreeMemory(void* buf, size_t length, void* data);

// external JS api - these are bound to the "spin" object on JS global
void Print(const v8::FunctionCallbackInfo<v8::Value> &args);
void Builtin(const v8::FunctionCallbackInfo<v8::Value> &args);
void Builtins(const v8::FunctionCallbackInfo<v8::Value> &args);
void EvaluateModule(const v8::FunctionCallbackInfo<v8::Value> &args);
void Library(const v8::FunctionCallbackInfo<v8::Value> &args);
void Libraries(const v8::FunctionCallbackInfo<v8::Value> &args);
void LoadModule(const v8::FunctionCallbackInfo<v8::Value> &args);
void NextTick(const v8::FunctionCallbackInfo<v8::Value> &args);
void RegisterCallback(const v8::FunctionCallbackInfo<v8::Value> &args);
void RunMicroTasks(const v8::FunctionCallbackInfo<v8::Value> &args);
void SetModuleCallbacks(const v8::FunctionCallbackInfo<v8::Value> &args);
void Utf8Decode(const v8::FunctionCallbackInfo<v8::Value> &args);
void Utf8Encode(const v8::FunctionCallbackInfo<v8::Value> &args);
void RunScript(const v8::FunctionCallbackInfo<v8::Value> &args);
void SetFlags(const v8::FunctionCallbackInfo<v8::Value> &args);

// fast api methods
void GetAddress(const v8::FunctionCallbackInfo<v8::Value> &args);
void fastGetAddress(void* p, struct FastApiTypedArray* const p_buf, 
  struct FastApiTypedArray* const p_ret);
void Utf8EncodeInto(const v8::FunctionCallbackInfo<v8::Value> &args);
int32_t fastUtf8EncodeInto (void* p, struct FastOneByteString* const p_str, struct FastApiTypedArray* const p_buf);
void Utf8EncodeIntoAtOffset(const v8::FunctionCallbackInfo<v8::Value> &args);
int32_t fastUtf8EncodeIntoAtOffset (void* p, struct FastOneByteString* const p_str, struct FastApiTypedArray* const p_buf, uint32_t off);
void Utf8Length(const v8::FunctionCallbackInfo<v8::Value> &args);
int32_t fastUtf8Length (void* p, struct FastOneByteString* const p_ret);

void HRTime(const v8::FunctionCallbackInfo<v8::Value> &args);
void fastHRTime (void* p, struct FastApiTypedArray* const p_ret);
void ReadMemory(const v8::FunctionCallbackInfo<v8::Value> &args);
void fastReadMemory (void* p, struct FastApiTypedArray* const p_buf, void* start, uint32_t size);
void ReadMemoryAtOffset(const v8::FunctionCallbackInfo<v8::Value> &args);
void fastReadMemoryAtOffset (void* p, struct FastApiTypedArray* const p_buf, void* start, uint32_t size, uint32_t off);
void WrapMemory(const v8::FunctionCallbackInfo<v8::Value> &args);
void UnWrapMemory(const v8::FunctionCallbackInfo<v8::Value> &args);
void GetMeta(const v8::FunctionCallbackInfo<v8::Value> &args);

// fast api properties
void GetErrno(const v8::FunctionCallbackInfo<v8::Value> &args);
int fastGetErrno(void* p);
void SetErrno(const v8::FunctionCallbackInfo<v8::Value> &args);
void fastSetErrno (void* p, int32_t e);

// Module Initialization
void Init(v8::Isolate* isolate, v8::Local<v8::ObjectTemplate> target);
}

#ifdef __cplusplus
extern "C"
    {
#endif

struct isolate_context {
  int rc;
  int argc;
  int fd;
  int buflen;
  int cleanup;
  int onexit;
  unsigned int main_len;
  unsigned int js_len;
  uint64_t start;
  char** argv;
  char* main;
  char* js;
  char* buf;
  char* globalobj;
  char* scriptname;
  void* startup_data;
  void* isolate;
};

int spin_create_isolate (int argc, char** argv, 
  const char* main, unsigned int main_len,
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname,
  int cleanup, int onexit, void* startup_data);
int spin_context_size ();
void spin_create_isolate_context (int argc, char** argv, 
  const char* main, unsigned int main_len,
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname,
  int cleanup, int onexit, void* startup_data, struct isolate_context* ctx);
void spin_start_isolate (void* ptr);
void spin_destroy_isolate_context (struct isolate_context* ctx);

struct exec_info {
  v8::Global<v8::Function> js_fn;
  v8::Isolate* isolate;
};
void spin_callback (exec_info* info);

#ifdef __cplusplus
    }
#endif


