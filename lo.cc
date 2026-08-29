#include <map>
#include <vector>
#include "lo.h"

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
using v8::Platform;
using v8::PromiseRejectMessage;
using v8::CFunction;
using v8::Global;
using v8::Exception;
using v8::CTypeInfo;
using v8::PropertyAttribute;
using v8::Signature;
using v8::ConstructorBehavior;
using v8::SideEffectType;
using v8::Data;
using v8::PrimitiveArray;
using v8::TypedArray;
using v8::Uint8Array;
using v8::Boolean;
using v8::ModuleRequest;
using v8::CFunctionInfo;
using v8::OOMDetails;
using v8::V8;
#if LO_V8_PROMISE_REJECT_EVENT_RENAMED
using v8::kDeprecatedPromiseRejectAfterResolved;
using v8::kDeprecatedPromiseResolveAfterResolved;
#else
using v8::kPromiseRejectAfterResolved;
using v8::kPromiseResolveAfterResolved;
#endif
using v8::kPromiseHandlerAddedAfterReject;
using v8::Script;
using v8::HeapStatistics;
using v8::BigUint64Array;

#ifdef _WIN32
static uint64_t hrtime_frequency_ = 0;
#else
int random_fd = -1;
#endif

extern char **environ;

std::map<std::string, lo::builtin*> builtins;
std::map<std::string, lo::register_plugin> modules;
std::unique_ptr<v8::Platform> platform;
// Generated in main.h, combines whatever bindings this specific build
// actually configured - not hardcoded to core, see lib/build.js's own
// comment on combined_binding_external_references() for the real bug
// this replaced (undefined symbol on any core-less build, e.g.
// runtime/zero-snap.config.js).
extern "C" const intptr_t* combined_binding_external_references();


CTypeInfo cargshrtime[2] = { 
  CTypeInfo(CTypeInfo::Type::kV8Value), 
  CTypeInfo(CTypeInfo::Type::kUint64)
};
CTypeInfo rchrtime = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo infohrtime = CFunctionInfo(rchrtime, 2, cargshrtime);
CFunction pFhrtime = CFunction((const void*)&lo::fastHRTime, 
  &infohrtime);

CTypeInfo cargsutf8length[2] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kSeqOneByteString)
};
CTypeInfo rcutf8length = CTypeInfo(CTypeInfo::Type::kInt32);
CFunctionInfo infoutf8length = CFunctionInfo(rcutf8length, 2, 
  cargsutf8length);
CFunction pFutf8length = CFunction((const void*)&lo::fastUtf8Length, 
  &infoutf8length);

CTypeInfo cargsutf8encodeinto[3] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kSeqOneByteString),
  CTypeInfo(CTypeInfo::Type::kUint64)
};
CTypeInfo rcutf8encodeinto = CTypeInfo(CTypeInfo::Type::kInt32);
CFunctionInfo infoutf8encodeinto = CFunctionInfo(rcutf8encodeinto, 3, 
  cargsutf8encodeinto);
CFunction pFutf8encodeinto = CFunction((const void*)&lo::fastUtf8EncodeInto, 
  &infoutf8encodeinto);

CTypeInfo cargsutf8encodeintoatoffset[4] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kSeqOneByteString),
  CTypeInfo(CTypeInfo::Type::kUint64),
  CTypeInfo(CTypeInfo::Type::kUint32)
};
CTypeInfo rcutf8encodeintoatoffset = CTypeInfo(CTypeInfo::Type::kInt32);
CFunctionInfo infoutf8encodeintoatoffset = CFunctionInfo(rcutf8encodeintoatoffset, 4, 
  cargsutf8encodeintoatoffset);
CFunction pFutf8encodeintoatoffset = CFunction((const void*)&lo::fastUtf8EncodeIntoAtOffset, 
  &infoutf8encodeintoatoffset);

CTypeInfo cargsreadmemory[4] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kUint64),
  CTypeInfo(CTypeInfo::Type::kUint64),
  CTypeInfo(CTypeInfo::Type::kUint32)
};
CTypeInfo rcreadmemory = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo inforeadmemory = CFunctionInfo(rcreadmemory, 4, 
  cargsreadmemory);
CFunction pFreadmemory = CFunction((const void*)&lo::fastReadMemory, 
  &inforeadmemory);

CTypeInfo cargsreadmemoryatoffset[5] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kUint64),
  CTypeInfo(CTypeInfo::Type::kUint64),
  CTypeInfo(CTypeInfo::Type::kUint32),
  CTypeInfo(CTypeInfo::Type::kUint32)
};
CTypeInfo rcreadmemoryatoffset = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo inforeadmemoryatoffset = CFunctionInfo(rcreadmemoryatoffset, 5, 
  cargsreadmemoryatoffset);
CFunction pFreadmemoryatoffset = CFunction((const void*)&lo::fastReadMemoryAtOffset, 
  &inforeadmemoryatoffset);

CTypeInfo cargserrnoset[2] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kInt32)
};
CTypeInfo rcerrnoset = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo infoerrnoset = CFunctionInfo(rcerrnoset, 2, 
  cargserrnoset);
CFunction pFerrnoset = CFunction((const void*)&lo::fastSetErrno, 
  &infoerrnoset);
CTypeInfo cargserrnoget[1] = {
  CTypeInfo(CTypeInfo::Type::kV8Value)
};
CTypeInfo rcerrnoget = CTypeInfo(CTypeInfo::Type::kInt32);
CFunctionInfo infoerrnoget = CFunctionInfo(rcerrnoget, 1, 
  cargserrnoget);
CFunction pFerrnoget = CFunction((const void*)&lo::fastGetErrno,
  &infoerrnoget);

// not declared in lo.h - a lo.cc-local, non-lo::-namespaced callback
void EnvironSlow(const FunctionCallbackInfo<Value> &args);

// Every native callback lo::Init() registers - both the ~40 plain
// FunctionCallback slow paths (SET_METHOD) and, for each of the 8
// SET_FAST_METHOD/SET_FAST_PROP fast-call sites, all three addresses
// V8 needs (the CFunction object itself, its raw function pointer via
// GetAddress(), and its CFunctionInfo via GetTypeInfo()) - a V8 startup
// snapshot fails otherwise. Confirmed directly, in this order:
// (1) with no external_references at all, CheckGlobalAndEternalHandles
// fails with exactly 8 unserialized <Foreign> handles (matching the 8
// fast-call sites); (2) registering only the 8 raw fast function
// pointers left that error completely unchanged - wrong guess; (3)
// disabling the fast sites entirely (proving lo::Init() as the cause)
// surfaced a *different* crash, "Unknown external reference", pointing
// at a plain slow callback instead - confirmed the ~40 SET_METHOD-only
// callbacks need registering too; (4) checking Node.js's own real
// solution to the identical problem (src/node_external_reference.h,
// ExternalReferenceRegistry::Register(const v8::CFunction&)) confirmed
// the missing piece: a CFunction site needs all three of &c_func,
// c_func.GetAddress(), and c_func.GetTypeInfo() registered, not just
// the raw function address. Given both v8::FunctionCallback and these
// raw C function pointers/CFunctionInfo* all reduce to distinct address
// values, listing them as one array here is fine - V8 only needs an
// exact address match, not distinct C++ types. PLAN.md task 64 - this
// fixed set covers lo::Init() itself; real lib/<binding> bindings each
// add their own callbacks/fast-call sites here too, not yet
// automated/generated (Node's own answer to that, confirmed above, is
// a mandatory per-binding registration convention, not full inference).
static const intptr_t lo_external_references[] = {
  // plain FunctionCallback slow paths
  (intptr_t)&lo::Print,
  (intptr_t)&lo::HRTime,
  (intptr_t)&lo::NextTick,
  (intptr_t)&lo::RunMicroTasks,
  (intptr_t)&lo::PumpMessageLoop,
  (intptr_t)&lo::Arch,
  (intptr_t)&lo::Os,
  (intptr_t)&lo::Exit,
  (intptr_t)&lo::GetErrno,
  (intptr_t)&lo::SetErrno,
  (intptr_t)&lo::Builtins,
  (intptr_t)&lo::Builtin,
  (intptr_t)&lo::Libraries,
  (intptr_t)&lo::Library,
  (intptr_t)&lo::SetModuleCallbacks,
  (intptr_t)&lo::LoadModule,
  (intptr_t)&lo::UnloadModule,
  (intptr_t)&lo::EvaluateModule,
  (intptr_t)&lo::GetIsolateStartAddress,
  (intptr_t)&lo::GetLoCallbackAddress,
  (intptr_t)&lo::Latin1Decode,
  (intptr_t)&lo::Utf8Decode,
  (intptr_t)&lo::Utf8Encode,
  (intptr_t)&lo::latin1Encode,
  (intptr_t)&lo::Utf8Length,
  (intptr_t)&lo::Utf8EncodeInto,
  (intptr_t)&lo::Utf8EncodeIntoAtOffset,
  (intptr_t)&lo::WrapMemory,
  (intptr_t)&lo::WrapMemoryShared,
  (intptr_t)&lo::UnWrapMemory,
  (intptr_t)&lo::GetAddress,
  (intptr_t)&lo::ReadMemory,
  (intptr_t)&lo::ReadMemoryAtOffset,
  (intptr_t)&lo::SetFlags,
  (intptr_t)&lo::GetMeta,
  (intptr_t)&lo::HeapUsage,
  (intptr_t)&lo::SharedMemoryUsage,
  (intptr_t)&EnvironSlow,
  (intptr_t)&lo::RunScript,
  (intptr_t)&lo::RegisterCallback,
  // fast-call sites: CFunction object, GetAddress(), GetTypeInfo() each
  (intptr_t)&pFhrtime, (intptr_t)pFhrtime.GetAddress(),
    (intptr_t)pFhrtime.GetTypeInfo(),
  (intptr_t)&pFerrnoget, (intptr_t)pFerrnoget.GetAddress(),
    (intptr_t)pFerrnoget.GetTypeInfo(),
  (intptr_t)&pFerrnoset, (intptr_t)pFerrnoset.GetAddress(),
    (intptr_t)pFerrnoset.GetTypeInfo(),
  (intptr_t)&pFutf8length, (intptr_t)pFutf8length.GetAddress(),
    (intptr_t)pFutf8length.GetTypeInfo(),
  (intptr_t)&pFutf8encodeinto, (intptr_t)pFutf8encodeinto.GetAddress(),
    (intptr_t)pFutf8encodeinto.GetTypeInfo(),
  (intptr_t)&pFutf8encodeintoatoffset,
    (intptr_t)pFutf8encodeintoatoffset.GetAddress(),
    (intptr_t)pFutf8encodeintoatoffset.GetTypeInfo(),
  (intptr_t)&pFreadmemory, (intptr_t)pFreadmemory.GetAddress(),
    (intptr_t)pFreadmemory.GetTypeInfo(),
  (intptr_t)&pFreadmemoryatoffset,
    (intptr_t)pFreadmemoryatoffset.GetAddress(),
    (intptr_t)pFreadmemoryatoffset.GetTypeInfo(),
  0
};

// v8 isolate callbacks
size_t lo::nearHeapLimitCallback(void* data, size_t current_heap_limit,
  size_t initial_heap_limit) {
  fprintf(stderr, "nearHeapLimitCallback\n");
  return 0;
}

void fatalErrorcallback (const char* location, const char* message) {
  fprintf(stderr, "fatalErrorcallback\n%s\n%s\n", location, message);
}

void OOMErrorcallback (const char* location, const OOMDetails& details) {
  fprintf(stderr, "OOMErrorcallback\n%s\nis heap oom? %d\n%s\n", location, 
    details.is_heap_oom, details.detail);
}

// TODO: it would be faster to just encode all the assets into a big buffer, with
// length prefixes and just receive them in one call
void lo::builtins_add (const char* name, const char* source, 
  unsigned int size) {
  struct builtin* b = new builtin();
  b->size = size;
  b->source = source;
  builtins[name] = b;
}

void lo::modules_add (const char* name, register_plugin plugin_handler) {
  modules[name] = plugin_handler;
}

void lo::FreeMemory(void* buf, size_t length, void* data) {
  free(buf);
}

// QN: how do we ensure an isolate doesn't allocate a bunch of external 
// memory and never free it? how do we ensure all memory created by an isolate
// is free when the isolate is destroyed?
void cleanupIsolate (Isolate* isolate) {
  isolate->ContextDisposedNotification();
  isolate->ClearKeptObjects();
  isolate->Dispose();
}

void lo::SET_PROP(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, FunctionCallback getter,
  FunctionCallback setter) {
  enum PropertyAttribute attributes =
      static_cast<PropertyAttribute>(PropertyAttribute::None | 
      PropertyAttribute::DontDelete);
  recv->SetAccessorProperty(
    String::NewFromUtf8(isolate, name).ToLocalChecked(),
    FunctionTemplate::New(isolate, getter),
    FunctionTemplate::New(isolate, setter),
    attributes
  );
}

void lo::SET_METHOD(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, FunctionCallback callback) {
  recv->Set(String::NewFromUtf8(isolate, name, 
    NewStringType::kInternalized).ToLocalChecked(), 
    FunctionTemplate::New(isolate, callback));
}

void lo::SET_MODULE(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, Local<ObjectTemplate> module) {
  recv->Set(String::NewFromUtf8(isolate, name, 
    NewStringType::kInternalized).ToLocalChecked(), 
    module);
}

void lo::SET_VALUE(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, Local<Value> value) {
  recv->Set(String::NewFromUtf8(isolate, name, 
    NewStringType::kInternalized).ToLocalChecked(), 
    value);
}

void lo::SET_FAST_METHOD(Isolate* isolate, Local<ObjectTemplate> 
  exports, const char * name, CFunction* fastCFunc, FunctionCallback slowFunc) {
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(
    isolate,
    slowFunc,
    Local<Value>(),
    Local<Signature>(),
    0,
    ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect,
    fastCFunc
  );
  exports->Set(
    String::NewFromUtf8(isolate, name).ToLocalChecked(),
    funcTemplate
  );
}

void lo::SET_FAST_PROP(Isolate* isolate, Local<ObjectTemplate> 
  exports, const char * name, CFunction* fastGetter, FunctionCallback slowGetter,
  CFunction* fastSetter, FunctionCallback slowSetter) {
  Local<FunctionTemplate> getter = FunctionTemplate::New(
    isolate,
    slowGetter,
    Local<Value>(),
    Local<Signature>(),
    0,
    ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect,
    fastGetter
  );
  Local<FunctionTemplate> setter = FunctionTemplate::New(
    isolate,
    slowSetter,
    Local<Value>(),
    Local<Signature>(),
    0,
    ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect,
    fastSetter
  );
  enum PropertyAttribute attributes =
      static_cast<PropertyAttribute>(PropertyAttribute::None | 
      PropertyAttribute::DontDelete);
  exports->SetAccessorProperty(
    String::NewFromUtf8(isolate, name).ToLocalChecked(),
    getter,
    setter,
    attributes
  );
}

void lo::PrintStackTrace(Isolate* isolate, const TryCatch& try_catch) {
  Local<Message> message = try_catch.Message();
  Local<StackTrace> stack = message->GetStackTrace();
  Local<Value> scriptName = message->GetScriptResourceName();
  String::Utf8Value scriptname(isolate, scriptName);
  Local<Context> context = isolate->GetCurrentContext();
  int linenum = message->GetLineNumber(context).FromJust();
  String::Utf8Value err_message(isolate, message->Get().As<String>());
  fprintf(stderr, "%s in %s on line %i\n", *err_message, *scriptname, linenum);
  if (stack.IsEmpty()) return;
  for (int i = 0; i < stack->GetFrameCount(); i++) {
    Local<StackFrame> stack_frame = stack->GetFrame(isolate, i);
    Local<String> functionName = stack_frame->GetFunctionName();
    Local<String> scriptName = stack_frame->GetScriptName();
    String::Utf8Value fn_name_s(isolate, functionName);
    String::Utf8Value script_name(isolate, scriptName);
    const int line_number = stack_frame->GetLineNumber();
    const int column = stack_frame->GetColumn();
    if (stack_frame->IsEval()) {
      if (stack_frame->GetScriptId() == Message::kNoScriptIdInfo) {
        fprintf(stderr, "    at [eval]:%i:%i\n", line_number, column);
      } else {
        fprintf(stderr, "    at [eval] (%s:%i:%i)\n", *script_name,
          line_number, column);
      }
      break;
    }
    if (fn_name_s.length() == 0) {
      fprintf(stderr, "    at %s:%i:%i\n", *script_name, line_number, column);
    } else {
      fprintf(stderr, "    at %s (%s:%i:%i)\n", *fn_name_s, *script_name,
        line_number, column);
    }
  }
  fflush(stderr);
}

void lo::PromiseRejectCallback(PromiseRejectMessage data) {
#if LO_V8_PROMISE_REJECT_EVENT_RENAMED
  if (data.GetEvent() == kDeprecatedPromiseRejectAfterResolved ||
      data.GetEvent() == kDeprecatedPromiseResolveAfterResolved) {
#else
  if (data.GetEvent() == kPromiseRejectAfterResolved ||
      data.GetEvent() == kPromiseResolveAfterResolved) {
#endif
    return;
  }
  Isolate* isolate = v8::Isolate::GetCurrent();
  if (data.GetEvent() == kPromiseHandlerAddedAfterReject) {
    return;
  }
  Local<Value> exception = data.GetValue();
  Local<Message> message;
  if (exception->IsObject()) {
    message = Exception::CreateMessage(isolate, exception);
  }
  if (!exception->IsNativeError() &&
      (message.IsEmpty() || message->GetStackTrace().IsEmpty())) {
    exception = Exception::Error(
        String::NewFromUtf8Literal(isolate, "Unhandled Promise."));
    message = Exception::CreateMessage(isolate, exception);
  }
  Local<Context> context = isolate->GetCurrentContext();
  TryCatch try_catch(isolate);
  Local<Object> globalInstance = context->Global();
  Local<Value> func = globalInstance->Get(context, 
    String::NewFromUtf8Literal(isolate, "onUnhandledRejection", 
      NewStringType::kNormal)).ToLocalChecked();
  if (func.IsEmpty()) {
    return;
  }
  Local<Function> onUnhandledRejection = Local<Function>::Cast(func);
  if (try_catch.HasCaught()) {
    fprintf(stderr, "PromiseRejectCallback: Cast\n");
    return;
  }
  Local<Value> argv[1] = { exception };
#if LO_V8_CALL_HAS_ISOLATE_OVERLOAD
  MaybeLocal<Value> result = onUnhandledRejection->Call(isolate, context,
    globalInstance, 1, argv);
#else
  MaybeLocal<Value> result = onUnhandledRejection->Call(context,
    globalInstance, 1, argv);
#endif
  if (result.IsEmpty() && try_catch.HasCaught()) {
    fprintf(stderr, "PromiseRejectCallback: Call\n");
  }
}

MaybeLocal<Module> lo::OnModuleInstantiate(Local<Context> context,
  Local<String> specifier,
  Local<FixedArray> import_assertions, 
  Local<Module> referrer) {

//  printf("OnModuleInstantiate, assertions: %i\n", import_assertions.->.Length());
  Isolate* isolate = v8::Isolate::GetCurrent();
  String::Utf8Value str(isolate, specifier);
  Local<Function> callback = 
    context->GetEmbedderData(2).As<Function>();
  Local<Value> argv[1] = { specifier };
#if LO_V8_CALL_HAS_ISOLATE_OVERLOAD
  MaybeLocal<Value> result = callback->Call(isolate, context,
    context->Global(), 1, argv);
#else
  MaybeLocal<Value> result = callback->Call(context,
    context->Global(), 1, argv);
#endif
  int identity = result.ToLocalChecked()->Uint32Value(context).ToChecked();
  std::map<int, Global<Module>> *module_map = static_cast<std::map<int, Global<Module>>*>(isolate->GetData(0));
  Local<Module> module = (*module_map)[identity].Get(isolate);
  return module;
}

MaybeLocal<Promise> OnDynamicImport(Local<Context> context,
  Local<Data> host_defined_options, Local<Value> resource_name,
  Local<String> specifier,Local<FixedArray> import_assertions) {
//  uint64_t start64 = (uint64_t)Local<Integer>::Cast(args[0])->Value();
//  printf("OnModuleInstantiate, assertions: %i\n", import_assertions->Length());
  Local<Promise::Resolver> resolver =
      Promise::Resolver::New(context).ToLocalChecked();
  MaybeLocal<Promise> promise(resolver->GetPromise());
  Local<Function> callback = 
    context->GetEmbedderData(1).As<Function>();
  Local<Value> argv[2] = { specifier, resource_name };
  MaybeLocal<Value> result = callback->Call(context, 
    context->Global(), 2, argv);
  return Local<Promise>::Cast(result.ToLocalChecked());
}

/*
this can be used to hook into jit events. we could allow setting this
when new isolate context is created for tracing jit events.
it has some overhead even when empty - ~300-400 microseconds
*/
void JitCodeEventHandler (const v8::JitCodeEvent* event) {
//  fprintf(stderr, "jit\n");
}

// this can be used to record counters for internal v8 events. it has negligible
// overhead when empty
int* CounterLookupCallback (const char* name) {
//  fprintf(stderr, "%s\n", name);
  return 0;
}

bool AbortOnUncaughtException (Isolate* isolate) {
  return true;
}

void LogEvent (const char* name, int status) {
  fprintf(stderr, "log %i %s\n", status, name);
}

void HistogramSampleCallback (void* histogram, int sample) {

}

void onJitEvent (const v8::JitCodeEvent* ev) {
  fprintf(stderr, "onJitEvent %i\n", ev->type);
}

int lo::CreateIsolate(int argc, char** argv,
  const char* main_src, unsigned int main_len,
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname, int cleanup,
  int onexit, void* startup_data) {
  Isolate::CreateParams create_params;
  int statusCode = 0;
  create_params.array_buffer_allocator =
    ArrayBuffer::Allocator::NewDefaultAllocator();
//  create_params.array_buffer_allocator = new lo::SpecialArrayBufferAllocator();
  //create_params.embedder_wrapper_type_index = 0;
  //create_params.embedder_wrapper_object_index = 1;
  // must match CreateSnapshot's SnapshotCreator external_references
  // exactly (same array, same order) whenever startup_data is a real
  // snapshot built with any set - harmless to always set. The blob
  // doesn't store raw pointers (meaningless across separate process
  // runs) - it stores indices into this array, resolved back to real
  // addresses at deserialize time using *this* array. A mismatch here
  // isn't a crash-on-load - it silently resolves later indices to
  // garbage, only surfacing the moment that restored object actually
  // gets touched. Real bug hit and fixed live, not guessed - this only
  // had lo_external_references, the per-build bindings' own combined
  // array (added to CreateSnapshot) was never mirrored here. Duplicated
  // rather than shared for now, same as args/isolate-callbacks above -
  // refactor later.
  std::vector<intptr_t> combined_refs;
  for (const intptr_t* p = lo_external_references; *p; p++) {
    combined_refs.push_back(*p);
  }
  for (const intptr_t* p = combined_binding_external_references(); *p; p++) {
    combined_refs.push_back(*p);
  }
  combined_refs.push_back(0);
  create_params.external_references = combined_refs.data();
  if (startup_data != NULL) {
    create_params.snapshot_blob = (const v8::StartupData*)startup_data;
  }

//  V8::InitializeExternalStartupDataFromFile("./scratch/snaps/foo.bin");

  //create_params.code_event_handler = JitCodeEventHandler;
//  create_params.counter_lookup_callback = CounterLookupCallback;
  //create_params.allow_atomics_wait = false;
  //create_params.only_terminate_in_safe_scope = false;
//  create_params.add_histogram_sample_callback = HistogramSampleCallback;
  create_params.fatal_error_callback = fatalErrorcallback;
  create_params.oom_error_callback = OOMErrorcallback;
  //Isolate *isolate = Isolate::Allocate();
  //create_params.code_event_handler = onJitEvent;
  Isolate *isolate = Isolate::New(create_params);
//  {
//    v8::Locker locker(isolate);
//{
  //  isolate->Enter();
    // we can call Isolate::SetData and Isolate::GetData before we initialize
  {
    Isolate::Scope isolate_scope(isolate);
    HandleScope handle_scope(isolate);
//    Isolate::Initialize(isolate, create_params);
    // TODO: we shoudl expose these to embedder in some way
    //isolate->SetRAILMode(v8::RAILMode::PERFORMANCE_RESPONSE);
    isolate->SetCaptureStackTraceForUncaughtExceptions(true, 1000, 
      StackTrace::kDetailed);
    //isolate->AddNearHeapLimitCallback(lo::nearHeapLimitCallback, 0);
    //isolate->SetAbortOnUncaughtExceptionCallback(AbortOnUncaughtException);
    isolate->SetPromiseRejectCallback(PromiseRejectCallback);
    isolate->SetHostImportModuleDynamicallyCallback(OnDynamicImport);
    //isolate->SetMicrotasksPolicy(v8::MicrotasksPolicy::kExplicit);
    //isolate->SetEventLogger(LogEvent);
    //isolate->SetFatalErrorHandler(fatalErrorcallback);
    //isolate->SetOOMErrorHandler(OOMErrorcallback);
    //isolate->EnableMemorySavingsMode();
    //isolate->SetData(0, 0);
    //isolate->SetMicrotasksPolicy(v8::MicrotasksPolicy::kExplicit);
    //std::map module_map = std::map<int, Global<Module>>();
    std::map<int, Global<Module>> module_map;
    isolate->SetData(0, &module_map);

    
    Local<ObjectTemplate> global = ObjectTemplate::New(isolate);
    Local<ObjectTemplate> runtime = ObjectTemplate::New(isolate);
    //runtime->SetImmutableProto();
    lo::Init(isolate, runtime);
    Local<Context> context = Context::New(isolate, NULL, global);
    Context::Scope context_scope(context);
    Local<Object> globalInstance = context->Global();
    globalInstance->Set(context, String::NewFromUtf8Literal(isolate, 
      "global", 
      NewStringType::kInternalized), globalInstance).Check();
    Local<Object> runtimeInstance = runtime->NewInstance(context).ToLocalChecked();
    Local<Array> arguments = Array::New(isolate);
    for (int i = 0; i < argc; i++) {
      arguments->Set(context, i, String::NewFromUtf8(isolate, argv[i], 
        NewStringType::kNormal, strlen(argv[i])).ToLocalChecked()).Check();
    }
    runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "args", 
      NewStringType::kInternalized), arguments).Check();
    if (buf != NULL) {
      std::unique_ptr<BackingStore> backing = 
        SharedArrayBuffer::NewBackingStore(buf, buflen, 
        [](void*, size_t, void*){}, nullptr);
      Local<SharedArrayBuffer> ab = SharedArrayBuffer::New(isolate, 
        std::move(backing));
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, 
        "buffer", NewStringType::kNormal), ab).Check();
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "buffer_address", 
        NewStringType::kInternalized), 
        Number::New(isolate, (uint64_t)buf)).Check();
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "buffer_len", 
        NewStringType::kInternalized), 
        Integer::New(isolate, buflen)).Check();
    }
    runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "argv", 
      NewStringType::kInternalized), 
      Number::New(isolate, (uint64_t)argv)).Check();
    runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "argc", 
      NewStringType::kInternalized), 
      Number::New(isolate, argc)).Check();
    if (start > 0) {
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "start", 
        NewStringType::kInternalized), 
        Number::New(isolate, start)).Check();
    }
    if (fd != 0) {
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "fd", 
        NewStringType::kInternalized), 
        Integer::New(isolate, fd)).Check();
    }
    if (js_len > 0 && main_len > 0) {
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, 
        "workerSource", NewStringType::kInternalized), 
        String::NewFromUtf8(isolate, js, NewStringType::kNormal, 
        js_len).ToLocalChecked()).Check();
    }
    globalInstance->Set(context, String::NewFromUtf8(isolate, globalobj, 
      NewStringType::kInternalized, strnlen(globalobj, 256)).ToLocalChecked(), 
      runtimeInstance).Check();
    TryCatch try_catch(isolate);
    if (startup_data == NULL) {
      Local<PrimitiveArray> opts =
          PrimitiveArray::New(isolate, lo::HostDefinedOptions::kLength);
      opts->Set(isolate, lo::HostDefinedOptions::kType,
        Number::New(isolate, lo::ScriptType::kModule));
      ScriptOrigin baseorigin(
        String::NewFromUtf8(isolate, scriptname, NewStringType::kInternalized, strnlen(scriptname, 1024)).ToLocalChecked(),
        0, // line offset
        0,  // column offset
        false, // is shared cross-origin
        -1,  // script id
        Local<Value>(), // source map url
        false, // is opaque
        false, // is wasm
        true,  // is module
        opts
      );
      Local<String> base;
      if (main_len > 0) {
        base = String::NewFromUtf8(isolate, main_src, NewStringType::kNormal,
          main_len).ToLocalChecked();
      } else {
        base = String::NewFromUtf8(isolate, js, NewStringType::kNormal,
          js_len).ToLocalChecked();
      }
      ScriptCompiler::Source basescript(base, baseorigin);
      Local<Module> module;
      if (!ScriptCompiler::CompileModule(isolate, &basescript).ToLocal(&module)) {
        PrintStackTrace(isolate, try_catch);
        return 1;
      }
      Maybe<bool> ok2 = module->InstantiateModule(context,
        lo::OnModuleInstantiate);
      if (ok2.IsNothing()) {
        if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
          try_catch.ReThrow();
        }
        // TODO: cleanup before return
        return 1;
      }
      errno = 0;
      module->Evaluate(context).ToLocalChecked();
      if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
        try_catch.ReThrow();
        return 1;
      }
    }
    // Call the same well-known entry point either way - whether the
    // module was just freshly compiled/evaluated above, or (startup_data
    // != NULL) already sat fully evaluated in a restored snapshot
    // context. globalThis.snapshotEntry, by convention, for this first
    // pass (PLAN.md task 64). Deliberately unconditional: a script using
    // this convention must behave identically whether or not it was
    // actually loaded from a snapshot - the alternative (only calling it
    // in the snapshot branch) means the exact same source silently does
    // nothing when built without a snapshot, which is surprising rather
    // than a real design choice.
    {
      Local<Value> entryVal;
      if (globalInstance->Get(context, String::NewFromUtf8Literal(isolate,
          "snapshotEntry", NewStringType::kInternalized)).ToLocal(&entryVal) &&
          entryVal->IsFunction()) {
        Local<Function> entry = Local<Function>::Cast(entryVal);
        MaybeLocal<Value> result = entry->Call(context, globalInstance, 0,
          nullptr);
        if (result.IsEmpty()) {
          if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
            try_catch.ReThrow();
          }
          return 1;
        }
      }
    }
    if (onexit == 1) {
      Local<Value> func = globalInstance->Get(context, 
        String::NewFromUtf8Literal(isolate, "onExit", 
          NewStringType::kNormal)).ToLocalChecked();
      if (func->IsFunction()) {
        Local<Function> onExit = Local<Function>::Cast(func);
        Local<Value> argv[1] = {Integer::New(isolate, 0)};
        MaybeLocal<Value> result = onExit->Call(context, globalInstance, 1, 
          argv);
        if (!result.IsEmpty()) {
          statusCode = result.ToLocalChecked()->Uint32Value(context).ToChecked();
        }
        if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
          lo::PrintStackTrace(isolate, try_catch);
          return 2;
        }
        statusCode = result.ToLocalChecked()->Uint32Value(context).ToChecked();
      }
    }
    module_map.clear();
    // todo: deref the globals in module_map - does it matter? won't they be cleaned up
    // when the isolate is destroyed?
//    isolate->Exit();
//}
  }
    if (cleanup == 1) {
//      uint64_t* ptr = (uint64_t*)startup_data;
//      *ptr = (uint64_t)isolate;
      cleanupIsolate(isolate);
      delete create_params.array_buffer_allocator;
//      isolate = nullptr;
    }

//  }
  return statusCode;
}

int lo::CreateIsolate(int argc, char** argv, const char* main_src,
  unsigned int main_len, uint64_t start, const char* globalobj, int cleanup,
  int onexit, void* startup_data) {
  return CreateIsolate(argc, argv, main_src, main_len, NULL, 0, NULL, 0, 0,
    start, globalobj, "main.js", cleanup, onexit, startup_data);
}

// builds a V8 startup snapshot: runs main_src (definitions only - no
// per-invocation args/workerSource/addresses/timing) to completion in a
// dedicated isolate that SnapshotCreator owns outright, then serializes
// the resulting heap/context to out_path. See PLAN.md task 64.
//
// Deliberately does NOT call lo::Init()/attach the RUNTIME (lo.*)
// object here - confirmed directly against real V8 source
// (src/api/api.cc:1344-1361) that any FunctionTemplate with a
// SET_FAST_METHOD/SET_FAST_PROP-style CFunction overload gets wrapped
// in i::Managed<i::CFunctionWithSignature>, V8's mechanism for an
// embedder-owned shared_ptr kept alive via a global handle - which has
// no serialization support at all (confirmed empirically first: a
// snapshot including lo::Init()'s runtime object fails
// CheckGlobalAndEternalHandles with exactly as many unserialized
// <Foreign> handles as lo::Init() has fast-call sites, completely
// unaffected by any external_references fix, since that check is a
// different V8 mechanism entirely - global handles vs. resolving
// pointers referenced from serialized objects). Not fixable from the
// embedder side. Since main_src only *references* lo.* lazily inside
// function bodies (never at top-level, so nothing needs it to exist
// yet at snapshot-build time) and CreateIsolate already
// unconditionally rebuilds+attaches the real runtime object before
// ever reaching the snapshot-vs-fresh branch below, omitting it here
// is correct, not a workaround - matches Node.js's own snapshot
// support, which requires the same explicit external-reference
// registration for every native binding (src/node_external_reference.h,
// src/node_snapshotable.cc's ValidateBindings), and could only work
// for CFunction-fast-call-shaped bindings at all with a per-binding
// registration convention already in the same category as this one.
// PLAN.md task 66 - was hardcoded to `core` specifically for this
// experiment, same as the hardcoded lo::Init(isolate, runtime) call
// below it. Fixed 2026-08-27 (PLAN.md task 72): real bug, not
// hypothetical - runtime/zero-snap.config.js's bindings=[] hit an
// undefined-symbol link failure on this exact hardcoding, reproduced
// directly. combined_binding_external_references() (generated in
// main.h, lib/build.js) now looks this up per binding the runtime
// actually declares, same list register_builtins() already uses.

int lo::CreateSnapshot(const char* main_src, unsigned int main_len,
  const char* out_path, int keep_code, int argc, char** argv) {
  // lo_external_references[] alone isn't enough once any linked-in
  // binding also has its own callbacks that might end up in the frozen
  // graph - concatenate every binding's external references into one
  // combined, null-terminated array. Must outlive the SnapshotCreator
  // construction below, hence a function-local std::vector rather than
  // a temporary.
  std::vector<intptr_t> combined_refs;
  for (const intptr_t* p = lo_external_references; *p; p++) {
    combined_refs.push_back(*p);
  }
  for (const intptr_t* p = combined_binding_external_references(); *p; p++) {
    combined_refs.push_back(*p);
  }
  combined_refs.push_back(0);

  Isolate::CreateParams create_params;
  create_params.array_buffer_allocator =
    ArrayBuffer::Allocator::NewDefaultAllocator();
  create_params.external_references = combined_refs.data();
  v8::SnapshotCreator creator(create_params);
  Isolate *isolate = creator.GetIsolate();
  {
    Isolate::Scope isolate_scope(isolate);
    HandleScope handle_scope(isolate);

    // Same isolate-level callbacks CreateIsolate always sets - missing
    // SetHostImportModuleDynamicallyCallback in particular is a likely
    // cause of a bare "Not supported" from V8 itself the moment
    // anything hits a dynamic import() with no callback registered to
    // handle it. Duplicated rather than shared, same as the args/argv
    // block below - refactor later.
    isolate->SetCaptureStackTraceForUncaughtExceptions(true, 1000,
      StackTrace::kDetailed);
    isolate->SetPromiseRejectCallback(PromiseRejectCallback);
    isolate->SetHostImportModuleDynamicallyCallback(OnDynamicImport);

    std::map<int, Global<Module>> module_map;
    isolate->SetData(0, &module_map);

    Local<ObjectTemplate> global = ObjectTemplate::New(isolate);
    Local<ObjectTemplate> runtime = ObjectTemplate::New(isolate);
    lo::InitSnapshot(isolate, runtime);

    Local<Context> context = Context::New(isolate, NULL, global);
    Context::Scope context_scope(context);
    Local<Object> globalInstance = context->Global();
    globalInstance->Set(context, String::NewFromUtf8Literal(isolate,
      "global", NewStringType::kInternalized), globalInstance).Check();

    Local<Object> runtimeInstance = runtime->NewInstance(context).ToLocalChecked();

    // Only ever true here - lo::Init()/runtimeInstance get rebuilt fresh
    // on every real invocation via CreateIsolate regardless of snapshot
    // use (PLAN.md task 64/66), and that path never sets this, so it's
    // undefined (falsy) at real runtime automatically, no explicit reset
    // needed. Lets main.js (or any loaded module) detect "am I running
    // during the snapshot build pass" and skip real dispatch/side effects
    // - same convention as Node's own v8.startupSnapshot.isBuildingSnapshot().
    runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate,
      "isBuildingSnapshot", NewStringType::kInternalized),
      Boolean::New(isolate, true)).Check();

    // Same fields CreateIsolate always sets fresh, from real argc/argv,
    // on every real invocation regardless of snapshot use - duplicated
    // here rather than shared, since this build-time argv/argc (whatever
    // main.cc's own --build-snapshot invocation happened to be called
    // with) is only ever used to get main.js's bootstrap dispatch logic
    // (args.length checks etc.) past a crash during this one-off build
    // pass. CreateIsolate's own unconditional re-set of these same
    // fields on every real invocation - snapshot-loaded or not - means
    // this build-time value never leaks into real usage; refactor to
    // share this with CreateIsolate later instead of duplicating.
    Local<Array> arguments = Array::New(isolate);
    for (int i = 0; i < argc; i++) {
      arguments->Set(context, i, String::NewFromUtf8(isolate, argv[i],
        NewStringType::kNormal, strlen(argv[i])).ToLocalChecked()).Check();
    }
    runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "args",
      NewStringType::kInternalized), arguments).Check();
    runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "argv",
      NewStringType::kInternalized),
      Number::New(isolate, (uint64_t)argv)).Check();
    runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "argc",
      NewStringType::kInternalized),
      Number::New(isolate, argc)).Check();

    globalInstance->Set(context, String::NewFromUtf8(isolate, "lo",
      NewStringType::kInternalized, 2).ToLocalChecked(),
      runtimeInstance).Check();

    TryCatch try_catch(isolate);
    Local<PrimitiveArray> opts =
        PrimitiveArray::New(isolate, lo::HostDefinedOptions::kLength);
    opts->Set(isolate, lo::HostDefinedOptions::kType,
      Number::New(isolate, lo::ScriptType::kModule));
    ScriptOrigin baseorigin(
      String::NewFromUtf8Literal(isolate, "snapshot"),
      0, 0, false, -1, Local<Value>(), false, false, true, opts);
    Local<String> src = String::NewFromUtf8(isolate, main_src,
      NewStringType::kNormal, main_len).ToLocalChecked();
    ScriptCompiler::Source basescript(src, baseorigin);
    Local<Module> module;
    if (!ScriptCompiler::CompileModule(isolate, &basescript).ToLocal(&module)) {
      lo::PrintStackTrace(isolate, try_catch);
      return 1;
    }
    Maybe<bool> ok = module->InstantiateModule(context,
      lo::OnModuleInstantiate);
    if (ok.IsNothing()) {
      if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
        lo::PrintStackTrace(isolate, try_catch);
      }
      return 1;
    }
    if (module->Evaluate(context).IsEmpty()) {
      if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
        lo::PrintStackTrace(isolate, try_catch);
      }
      return 1;
    }
    // Module::Evaluate() returns a completion *promise*, not a settled
    // value (true since top-level await landed in V8) - the code above
    // only checked whether the call itself threw synchronously, never
    // whether that promise (or any promise from a dynamic import() this
    // pass triggered via lo::OnDynamicImport) actually resolved. Without
    // draining the microtask queue here, anything not already
    // synchronously settled gets frozen mid-flight into the blob - a
    // pending promise and an unfired .then() continuation, not the
    // value real code would expect post-restore. v8-isolate.h's own doc
    // comment for PerformMicrotaskCheckpoint() says it "[r]uns the
    // default MicrotaskQueue until it gets empty" - one call already
    // accounts for microtasks enqueued while draining, so this loop is
    // defensive (harmless no-op once the queue is empty) rather than
    // strictly required for the common case, but guards against any
    // multi-round resolution chain (e.g. a resolved dynamic import's
    // continuation itself issuing another import) without needing an
    // API to query "is the queue really empty" first.
    // Real, known limitation, not fixed here: PerformMicrotaskCheckpoint()'s
    // own doc comment says "[a]ny exceptions thrown by microtask callbacks
    // are swallowed" - a rejected promise with no .catch() during this pass
    // (e.g. a dynamic import() of a nonexistent file) fails silently, not
    // via try_catch the way every other error path in this function does.
    // A follow-up isolate->HasPendingException()-style check right after
    // this loop would be needed to surface that case loudly instead of
    // producing a blob with a quietly-broken module - not added here since
    // it wasn't asked for and needs its own verification.
    for (int i = 0; i < 10; i++) {
      isolate->PerformMicrotaskCheckpoint();
    }
    creator.SetDefaultContext(context);
  }
  // CreateBlob() must not be called from within a handle scope - the
  // block above has already closed.
  v8::StartupData blob = creator.CreateBlob(
    keep_code ? v8::SnapshotCreator::FunctionCodeHandling::kKeep
              : v8::SnapshotCreator::FunctionCodeHandling::kClear);
  if (blob.data == nullptr) {
    fprintf(stderr, "lo: snapshot creation failed\n");
    return 1;
  }
  int fd = open(out_path, O_WRONLY | O_CREAT | O_TRUNC,
    S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH);
  if (fd < 0) {
    fprintf(stderr, "lo: unable to open %s for writing\n", out_path);
    delete[] blob.data;
    return 1;
  }
  long written = write(fd, blob.data, blob.raw_size);
  close(fd);
  delete[] blob.data;
  if (written < blob.raw_size) {
    fprintf(stderr, "lo: short write to %s\n", out_path);
    return 1;
  }
  return 0;
}

// TODO: in libraries, the init code is very slow and it never frees the
// fastcall structures it creates
// TODO: this is very slow
void lo::Library(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  Local<ObjectTemplate> exports = ObjectTemplate::New(isolate);
  if (args[0]->IsString()) {
    String::Utf8Value name(isolate, args[0]);
    auto iter = modules.find(*name);
    if (iter == modules.end()) {
//      fprintf(stderr, "ohno %s\n", *name);
      return;
    } else {
      // TODO does it need to register if called multiple times??
      register_plugin _init = (*iter->second);
      auto _register = reinterpret_cast<InitializerCallback>(_init());
      _register(isolate, exports);
    }
  } else {
    uint64_t start64 = (uint64_t)Local<Integer>::Cast(args[0])->Value();
    void* ptr = reinterpret_cast<void*>(start64);
    register_plugin _init = reinterpret_cast<register_plugin>(ptr);
    auto _register = reinterpret_cast<InitializerCallback>(_init());
    _register(isolate, exports);
  }
  args.GetReturnValue().Set(exports->NewInstance(context).ToLocalChecked());
}

// TODO: this is very slow. we need a better data structure and/or to cache
// the results
void lo::Builtin(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  String::Utf8Value name(isolate, args[0]);
  auto iter = builtins.find(*name);
  if (iter == builtins.end()) {
    args.GetReturnValue().Set(Null(isolate));
    return;
  }
  lo::builtin* b = (iter->second);
  if (args.Length() == 1) {
    args.GetReturnValue().Set(String::NewFromUtf8(isolate, b->source, 
      NewStringType::kNormal, b->size).ToLocalChecked());
    return;
  }
  // TODO: does it need to be a shared buffer?
  std::unique_ptr<BackingStore> backing = SharedArrayBuffer::NewBackingStore(
      (void*)b->source, b->size, [](void*, size_t, void*){}, nullptr);
  Local<SharedArrayBuffer> ab = SharedArrayBuffer::New(isolate, 
    std::move(backing));
  args.GetReturnValue().Set(ab);
}

void lo::RunMicroTasks(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  isolate->PerformMicrotaskCheckpoint();
  //args.GetIsolate()->RunMicroTasks();
  args.GetReturnValue().Set(Integer::New(isolate, v8::MicrotasksScope::GetCurrentDepth(isolate)));
}

void lo::PumpMessageLoop(const FunctionCallbackInfo<Value> &args) {
//  Isolate* isolate = args.GetIsolate();
//  v8::platform::PumpMessageLoop(default_platform, isolate, v8::platform::MessageLoopBehavior::kDoNotWait);

}

void lo::NextTick(const FunctionCallbackInfo<Value>& args) {
  args.GetIsolate()->EnqueueMicrotask(args[0].As<Function>());
}

void lo::RegisterCallback(const FunctionCallbackInfo<Value>& args) {
  struct exec_info* info = reinterpret_cast<struct exec_info*>(
    (uint64_t)Local<Integer>::Cast(args[0])->Value());
  Local<Function> fn = args[1].As<Function>();
  int nargs = Local<Integer>::Cast(args[2])->Value();
  Isolate* isolate = args.GetIsolate();
  info->isolate = isolate;
  info->nargs = nargs;
//  info->js_ctx.Reset(isolate, Global<Context>(isolate, isolate->GetCurrentContext()));
  info->js_fn.Reset(isolate, Global<Function>(isolate, fn));
}

// TODO: UnregisterCallback

void lo::EvaluateModule(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  int identity = Local<Integer>::Cast(args[0])->Value();

  std::map<int, Global<Module>> *module_map = static_cast<std::map<int, Global<Module>>*>(isolate->GetData(0));
  Local<Module> module = (*module_map)[identity].Get(isolate);
  if (module->GetStatus() >= 4) {
    args.GetReturnValue().Set(module->GetModuleNamespace().As<Promise>());
    return;
  }
  Maybe<bool> result = module->InstantiateModule(context, 
    lo::OnModuleInstantiate);
  if (result.IsNothing()) {
    printf("\nCan't instantiate module.\n");
    return;
  }
/*
  if (module->GetStatus() >= 4) {
    args.GetReturnValue().Set(module->GetModuleNamespace().As<Promise>());
    return;
  }
*/
  TryCatch try_catch(isolate);
  Local<Value> retValue;
  if (!module->Evaluate(context).ToLocal(&retValue)) {
    printf("Error evaluating module!\n");
    return;
  }
  if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
    try_catch.ReThrow();
    return;
  }
  args.GetReturnValue().Set(module->GetModuleNamespace().As<Promise>());
}

// TODO: this is terribly slow
void lo::UnloadModule(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  int identity = Local<Integer>::Cast(args[0])->Value();
  std::map<int, Global<Module>> *module_map = static_cast<std::map<int, Global<Module>>*>(isolate->GetData(0));
  (*module_map).erase(identity);
}

void lo::LoadModule(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  // Real, confirmed crash (not hypothetical): args[0].As<String>() below is
  // an unchecked cast - V8's ::As<T>() never validates, it just
  // reinterprets the handle. builtin() returns Null for a specifier that
  // isn't embedded in this binary, and on_module_load() (main.js/runtime
  // JS) passes that straight through with no null-check of its own - the
  // resulting type-confused "string" handle doesn't fail here, it crashes
  // much later and much less legibly, deep inside V8's own scanner
  // (ScannerStream::For -> V8_Fatal), once ScriptCompiler::CompileModule
  // actually tries to read it as a string. See LO.md's crash-reporting
  // section for the debugging session that found this.
  //
  // This check must run before the TryCatch below is constructed: a
  // ThrowException() while a local TryCatch is active gets captured by
  // it, not propagated to the JS caller - confirmed directly (the
  // exception was silently swallowed, `mod` ended up `undefined` instead
  // of the caller ever seeing a catchable error, until this was moved
  // above the TryCatch's declaration).
  if (!args[0]->IsString()) {
    isolate->ThrowException(Exception::TypeError(String::NewFromUtf8Literal(
      isolate, "loadModule: source must be a string (got null/non-string - "
        "the module was likely not found/embedded)")));
    return;
  }
  TryCatch try_catch(isolate);
  Local<String> source = args[0].As<String>();
  Local<String> path = args[1].As<String>();
  Local<PrimitiveArray> opts =
      PrimitiveArray::New(isolate, lo::HostDefinedOptions::kLength);
  opts->Set(isolate, lo::HostDefinedOptions::kType,
                            Number::New(isolate, lo::ScriptType::kModule));
  // https://github.com/nodejs/node/blob/main/src/compile_cache.cc#L247
  // https://github.com/nodejs/node/blob/75741a19524c3cf3a9671ee227e806cf842e9a86/src/node_builtins.cc#L365
  //opts->Set(isolate, produce_data_to_cache, true);
  ScriptOrigin baseorigin(
    path, // resource name
    0, // line offset
    0,  // column offset
    false, // is shared cross-origin
    -1,  // script id
    Local<Value>(), // source map url
    false, // is opaque
    false, // is wasm
    true, // is module
    opts);
  bool ok = false;
  Local<Module> module;
  if (args.Length() == 2) {
    ScriptCompiler::Source base(source, baseorigin);
    ok = ScriptCompiler::CompileModule(isolate, &base).ToLocal(&module);
  } else {
    Local<Object> meta = args[2].As<Object>();
//    Local<ArrayBuffer> ab = args[2].As<ArrayBuffer>();
//    v8::ScriptCompiler::CachedData cached((const uint8_t*)ab->Data(), ab->ByteLength(), v8::ScriptCompiler::CachedData::BufferPolicy::BufferNotOwned);
#if LO_V8_INTERNAL_FIELD_TAG
    v8::ScriptCompiler::CachedData* cached = (v8::ScriptCompiler::CachedData*)meta->GetAlignedPointerFromInternalField(1, v8::kEmbedderDataTypeTagDefault);
#else
    v8::ScriptCompiler::CachedData* cached = (v8::ScriptCompiler::CachedData*)meta->GetAlignedPointerFromInternalField(1);
#endif
    ScriptCompiler::Source base(source, baseorigin, cached);
    ScriptCompiler::CompileOptions options = ScriptCompiler::kConsumeCodeCache;
    ok = ScriptCompiler::CompileModule(isolate, &base, options).ToLocal(&module);
  }
  if (!ok) {
    String::Utf8Value path(args.GetIsolate(), args[1]);
    fprintf(stderr, "Error compiling %s\n", *path);
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }

  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();

/*
  if (args.Length() == 2) {
    v8::ScriptCompiler::CreateCodeCache(module->GetUnboundModuleScript());
    v8::ScriptCompiler::CachedData* cache = v8::ScriptCompiler::CreateCodeCache(module->GetUnboundModuleScript());
    Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
    tpl->SetInternalFieldCount(2);
    Local<Object> d = tpl->NewInstance(context).ToLocalChecked();

#if LO_V8_INTERNAL_FIELD_TAG
    d->SetAlignedPointerInInternalField(1, cache, v8::kEmbedderDataTypeTagDefault);
#else
    d->SetAlignedPointerInInternalField(1, cache);
#endif
    data->Set(context, String::NewFromUtf8(isolate, "cache")
      .ToLocalChecked(), d).Check();
  }
*/

  Local<Array> requests = Array::New(isolate);
  Local<FixedArray> module_requests = module->GetModuleRequests();
  int length = module_requests->Length();
  for (int i = 0; i < length; ++i) {
#if LO_V8_FIXEDARRAY_GET_NO_CONTEXT
    Local<ModuleRequest> module_request =
        module_requests->Get(i).As<ModuleRequest>();
#else
    Local<ModuleRequest> module_request =
        module_requests->Get(context, i).As<ModuleRequest>();
#endif
    requests->Set(context, i, module_request->GetSpecifier()).Check();
  }
  std::map<int, Global<Module>> *module_map = static_cast<std::map<int, Global<Module>>*>(isolate->GetData(0));

  (*module_map).insert(std::make_pair(module->GetIdentityHash(), 
    Global<Module>(isolate, module)));
  data->Set(context, String::NewFromUtf8(isolate, "requests")
    .ToLocalChecked(), requests).Check();
  data->Set(context, String::NewFromUtf8(isolate, "isSourceTextModule")
    .ToLocalChecked(), Boolean::New(isolate, module->IsSourceTextModule()))
    .Check();
  data->Set(context, String::NewFromUtf8(isolate, "status")
    .ToLocalChecked(), Integer::New(isolate, module->GetStatus()))
    .Check();
  data->Set(context, String::NewFromUtf8(isolate, "specifier")
    .ToLocalChecked(), path).Check();
  data->Set(context, String::NewFromUtf8(isolate, "src")
    .ToLocalChecked(), source).Check();
  data->Set(context, String::NewFromUtf8(isolate, "identity")
    .ToLocalChecked(), Integer::New(isolate, module->GetIdentityHash()))
    .Check();
  data->Set(context, String::NewFromUtf8(isolate, "scriptId")
    .ToLocalChecked(), Integer::New(isolate, module->ScriptId())).Check();
  args.GetReturnValue().Set(data);
}

// TODO: these could both be fast calls if we just wrote to a buffer
// and parse on the other side - probably not any quicker though
void lo::Builtins(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  Local<Array> b = Array::New(isolate);
  int i = 0;
  for (auto const& builtin : builtins) {
    b->Set(context, i++, String::NewFromUtf8(isolate, builtin.first.c_str(), 
      NewStringType::kNormal, builtin.first.length()).ToLocalChecked()).Check();
  }
  args.GetReturnValue().Set(b);
}

void lo::Libraries(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  Local<Array> m = Array::New(isolate);
  int i = 0;
  for (auto const& module : modules) {
    m->Set(context, i++, String::NewFromUtf8(isolate, module.first.c_str(), 
      NewStringType::kNormal, module.first.length()).ToLocalChecked()).Check();
  }
  args.GetReturnValue().Set(m);
}

void lo::SetModuleCallbacks(const FunctionCallbackInfo<Value> &args) {
  // todo: is putting this in context correct?
  Local<Context> context = args.GetIsolate()->GetCurrentContext();
  context->SetEmbedderData(1, args[0].As<Function>()); // async resolver
  context->SetEmbedderData(2, args[1].As<Function>()); // sync resolver
}

// fast api calls
void lo::GetErrno(const FunctionCallbackInfo<Value> &args) {
  args.GetReturnValue().Set(errno);
}

int lo::fastGetErrno (void* p) {
  return errno;
}

void lo::SetErrno(const FunctionCallbackInfo<Value> &args) {
  errno = Local<Integer>::Cast(args[0])->Value();
}

void lo::fastSetErrno (void* p, int32_t e) {
  errno = e;
}

uint64_t lo::hrtime() {
#if defined(_WIN32)
  // stolen from libuv: https://github.com/libuv/libuv/blob/v1.x/src/win/util.c
  LARGE_INTEGER counter;
  double scaled_freq;
  double result;
  if (hrtime_frequency_ == 0) {
    LARGE_INTEGER perf_frequency;
    if (QueryPerformanceFrequency(&perf_frequency)) {
      hrtime_frequency_ = perf_frequency.QuadPart;
    }
    if (hrtime_frequency_ == 0) return 0;
  }
  if (!QueryPerformanceCounter(&counter)) return 0;
  scaled_freq = (double) hrtime_frequency_ / 1000000000;
  result = (double) counter.QuadPart / scaled_freq;
  return (uint64_t) result;
#else
  struct timespec t;
  if (clock_gettime(CLOCK_MONOTONIC, &t)) return 0;
  return (t.tv_sec * (uint64_t) 1e9) + t.tv_nsec;
#endif
}

void lo::HRTime(const FunctionCallbackInfo<Value> &args) {
  uint64_t* v1 = reinterpret_cast<uint64_t*>((uint64_t)Local<Integer>::Cast(args[0])->Value());
  v1[0] = hrtime();
}

void lo::fastHRTime (void* p, uint64_t* p_ret) {
  p_ret[0] = hrtime();
}

void lo::GetAddress(const FunctionCallbackInfo<Value> &args) {
  Local<TypedArray> ta = args[0].As<TypedArray>();
  uint8_t* ptr = (uint8_t*)ta->Buffer()->Data() + ta->ByteOffset();
  ((uint64_t*)args[1].As<Uint32Array>()->Buffer()->Data())[0] = (uint64_t)ptr;
}

void lo::Utf8Length(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
#if LO_V8_STRING_WRITE_V2
  args.GetReturnValue().Set(Integer::New(isolate, args[0].As<String>()->Utf8LengthV2(isolate)));
#else
  args.GetReturnValue().Set(Integer::New(isolate, args[0].As<String>()->Utf8Length(isolate)));
#endif
}

int32_t lo::fastUtf8Length (void* p, struct FastOneByteString* const p_str) {
  return p_str->length;
}

void lo::SharedMemoryUsage(const FunctionCallbackInfo<Value> &args) {
  v8::SharedMemoryStatistics v8_shm_stats;
  v8::V8::GetSharedMemoryStatistics(&v8_shm_stats);
  Local<BigUint64Array> array = args[0].As<BigUint64Array>();
  uint64_t *fields = static_cast<uint64_t *>(array->Buffer()->Data());
  fields[0] = v8_shm_stats.read_only_space_size();
  fields[1] = v8_shm_stats.read_only_space_used_size();
  fields[2] = v8_shm_stats.read_only_space_physical_size();
}

void lo::HeapUsage(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  HeapStatistics v8_heap_stats;
  isolate->GetHeapStatistics(&v8_heap_stats);
  Local<BigUint64Array> array = args[0].As<BigUint64Array>();
  uint64_t *fields = static_cast<uint64_t *>(array->Buffer()->Data());
  fields[0] = v8_heap_stats.total_heap_size();
  fields[1] = v8_heap_stats.used_heap_size();
  //fields[2] = isolate->AdjustAmountOfExternalAllocatedMemory(0);
  fields[2] = v8_heap_stats.external_memory();
  fields[3] = v8_heap_stats.does_zap_garbage();
  fields[4] = v8_heap_stats.heap_size_limit();
  fields[5] = v8_heap_stats.malloced_memory();
  fields[6] = v8_heap_stats.number_of_detached_contexts();
  fields[7] = v8_heap_stats.number_of_native_contexts();
  fields[8] = v8_heap_stats.peak_malloced_memory();
  fields[9] = v8_heap_stats.total_available_size();
  fields[10] = v8_heap_stats.total_heap_size_executable();
  fields[11] = v8_heap_stats.total_physical_size();
}

void lo::GetMeta(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  Local<Object> meta = args[1].As<Object>();
  if (args[0]->IsString()) {
    Local<String> str = args[0].As<String>();
    if (str->IsExternalOneByte()) {
      meta->Set(context, String::NewFromUtf8Literal(isolate, "isExternalOneByte", 
        NewStringType::kInternalized), v8::Boolean::New(isolate, true)).Check();
    } else if (str->IsOneByte()) {
      meta->Set(context, String::NewFromUtf8Literal(isolate, "isOneByte", 
        NewStringType::kInternalized), v8::Boolean::New(isolate, true)).Check();
    } else {
      meta->Set(context, String::NewFromUtf8Literal(isolate, "isTwoByte", 
        NewStringType::kInternalized), v8::Boolean::New(isolate, true)).Check();
    }
    return;
  }
  bool isExternal = false;
  bool isDetachable = false;
  bool isShared = false;
  if (args[0]->IsArrayBuffer()) {
    Local<ArrayBuffer> buf = args[0].As<ArrayBuffer>();
    isExternal = buf->IsExternal();
    isDetachable = buf->IsDetachable();
  } else if (args[0]->IsSharedArrayBuffer()) {
    Local<SharedArrayBuffer> buf = args[0].As<SharedArrayBuffer>();
    isExternal = buf->IsExternal();
    isShared = true;
  } else if (args[0]->IsTypedArray()) {
    Local<ArrayBuffer> buf = args[0].As<TypedArray>()->Buffer();
    isExternal = buf->IsExternal();
    isDetachable = buf->IsDetachable();
  }
  meta->Set(context, String::NewFromUtf8Literal(isolate, "isExternal", 
    NewStringType::kInternalized), v8::Boolean::New(isolate, isExternal)).Check();
  meta->Set(context, String::NewFromUtf8Literal(isolate, "isDetachable", 
    NewStringType::kInternalized), v8::Boolean::New(isolate, isDetachable)).Check();
  meta->Set(context, String::NewFromUtf8Literal(isolate, "isShared", 
    NewStringType::kInternalized), v8::Boolean::New(isolate, isShared)).Check();
}

void lo::ReadMemory(const FunctionCallbackInfo<Value> &args) {
  char* dest = reinterpret_cast<char*>(Local<Integer>::Cast(args[0])->Value());
//  Local<Uint8Array> u8 = args[0].As<Uint8Array>();
//  uint8_t* dest = (uint8_t*)u8->Buffer()->Data() + u8->ByteOffset();
  void* start = reinterpret_cast<void*>(
    (uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t size = Local<Integer>::Cast(args[2])->Value();
  memcpy(dest, start, size);
}

void lo::fastReadMemory (void* p, uint64_t* p_buf, 
  void* start, uint32_t size) {
  memcpy(p_buf, start, size);
}

// todo: version that wraps memory in place with an arraybuffer
void lo::ReadMemoryAtOffset(const FunctionCallbackInfo<Value> &args) {
//  Local<Uint8Array> u8 = args[0].As<Uint8Array>();
  uint32_t off = Local<Integer>::Cast(args[3])->Value();
  char* dest = reinterpret_cast<char*>(Local<Integer>::Cast(args[0])->Value()) + off;
//  uint8_t* dest = (uint8_t*)u8->Buffer()->Data() + off;
  void* start = reinterpret_cast<void*>(
    (uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t size = Local<Integer>::Cast(args[2])->Value();
  memcpy(dest, start, size);
}

void lo::fastReadMemoryAtOffset (void* p, uint64_t* p_buf, 
  void* start, uint32_t size, uint32_t off) {
  uint8_t* ptr = (uint8_t*)p_buf + off;
  memcpy(ptr, start, size);
}

// todo: need this for sharedarraybuffer
void lo::WrapMemory(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
//  HandleScope scope(isolate);
  uint64_t start64 = (uint64_t)Local<Number>::Cast(args[0])->Value();
  uint32_t size = (uint32_t)Local<Integer>::Cast(args[1])->Value();
  void* start = reinterpret_cast<void*>(start64);
  int32_t free_memory = 0;
  if (args.Length() > 2) {
    free_memory = (int32_t)Local<Integer>::Cast(args[2])->Value();
  }
  if (free_memory == 0) {
    std::unique_ptr<BackingStore> backing = ArrayBuffer::NewBackingStore(
        start, size, v8::BackingStore::EmptyDeleter, nullptr);
    Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
    args.GetReturnValue().Set(ab);
    return;
  }
  std::unique_ptr<BackingStore> backing = ArrayBuffer::NewBackingStore(
      start, size, lo::FreeMemory, nullptr);
  Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
  args.GetReturnValue().Set(ab);
}

// todo: need this for sharedarraybuffer
void lo::WrapMemoryShared(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
//  HandleScope scope(isolate);
  uint64_t start64 = (uint64_t)Local<Number>::Cast(args[0])->Value();
  uint32_t size = (uint32_t)Local<Integer>::Cast(args[1])->Value();
  void* start = reinterpret_cast<void*>(start64);
  int32_t free_memory = 0;
  if (args.Length() > 2) {
    free_memory = (int32_t)Local<Integer>::Cast(args[2])->Value();
  }
  if (free_memory == 0) {
    std::unique_ptr<BackingStore> backing = SharedArrayBuffer::NewBackingStore(
        start, size, v8::BackingStore::EmptyDeleter, nullptr);
    Local<SharedArrayBuffer> ab = SharedArrayBuffer::New(isolate, std::move(backing));
    args.GetReturnValue().Set(ab);
    return;
  }
  std::unique_ptr<BackingStore> backing = SharedArrayBuffer::NewBackingStore(
      start, size, lo::FreeMemory, nullptr);
  Local<SharedArrayBuffer> ab = SharedArrayBuffer::New(isolate, std::move(backing));
  args.GetReturnValue().Set(ab);
}

void lo::UnWrapMemory(const FunctionCallbackInfo<Value> &args) {
  Local<ArrayBuffer> ab = args[0].As<ArrayBuffer>();
  ab->Detach();
  // todo: return pointer here so we don't need to get it before
}

void lo::SetFlags(const FunctionCallbackInfo<Value> &args) {
  String::Utf8Value flags(args.GetIsolate(), args[0]);
  //V8::SetFlagsFromString(*flags, static_cast<size_t>(flags.length()));
  V8::SetFlagsFromString(*flags);
}

void lo::Utf8Encode(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  if (str->IsOneByte()) {
    int size = str->Length();
    std::unique_ptr<BackingStore> backing =
      ArrayBuffer::NewBackingStore(isolate, size);
#if LO_V8_STRING_WRITE_V2
    str->WriteOneByteV2(isolate, 0, size, static_cast<uint8_t*>(backing->Data()), String::WriteFlags::kNone);
#else
    str->WriteOneByte(isolate, static_cast<uint8_t*>(backing->Data()), 0, size, String::NO_NULL_TERMINATION);
#endif
    Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
    args.GetReturnValue().Set(Uint8Array::New(ab, 0, size));
    return;
  }
#if LO_V8_STRING_WRITE_V2
  int size = str->Utf8LengthV2(isolate);
  std::unique_ptr<BackingStore> backing =
    ArrayBuffer::NewBackingStore(isolate, size);
  size_t written = 0;
  str->WriteUtf8V2(isolate, static_cast<char*>(backing->Data()), size, String::WriteFlags::kNone, &written);
#else
  int size = str->Utf8Length(isolate);
  std::unique_ptr<BackingStore> backing =
    ArrayBuffer::NewBackingStore(isolate, size);
  str->WriteUtf8(isolate, static_cast<char*>(backing->Data()), size, nullptr, String::NO_NULL_TERMINATION);
#endif
  Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
  args.GetReturnValue().Set(Uint8Array::New(ab, 0, size));
}

void lo::latin1Encode(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  int size = str->Length();
  std::unique_ptr<BackingStore> backing =
    ArrayBuffer::NewBackingStore(isolate, size);
#if LO_V8_STRING_WRITE_V2
  str->WriteOneByteV2(isolate, 0, size, static_cast<uint8_t*>(backing->Data()), String::WriteFlags::kNone);
#else
  str->WriteOneByte(isolate, static_cast<uint8_t*>(backing->Data()), 0, size, String::NO_NULL_TERMINATION);
#endif
  Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
  args.GetReturnValue().Set(Uint8Array::New(ab, 0, size));
}

// todo - we should have latin1 methods 
void lo::Utf8Decode(const FunctionCallbackInfo<Value> &args) {
  int size = -1;
  if (args.Length() > 1) {
    size = Local<Integer>::Cast(args[1])->Value();
  }
  char* str = reinterpret_cast<char*>(
    (uint64_t)Local<Integer>::Cast(args[0])->Value());
  args.GetReturnValue().Set(String::NewFromUtf8(args.GetIsolate(), 
    str, NewStringType::kNormal, size).ToLocalChecked());
}

// todo - we should have latin1 methods 
void lo::Latin1Decode(const FunctionCallbackInfo<Value> &args) {
  int size = -1;
  if (args.Length() > 1) {
    size = Local<Integer>::Cast(args[1])->Value();
  }
  uint8_t* str = reinterpret_cast<uint8_t*>(
    (uint64_t)Local<Integer>::Cast(args[0])->Value());
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    str, NewStringType::kNormal, size).ToLocalChecked());
}
/*
void lo::Utf8EncodeInto(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  if (str->IsOneByte()) {
    int size = str->Length();
    Local<Uint8Array> u8 = args[1].As<Uint8Array>();
    uint8_t* dest = (uint8_t*)u8->Buffer()->Data() + u8->ByteOffset();
    int written = str->WriteOneByte(isolate, dest, 0, size, 
      String::NO_NULL_TERMINATION);
    args.GetReturnValue().Set(Integer::New(isolate, written));
    return;
  }
  int written = 0;
  int size = str->Utf8Length(isolate);
  Local<Uint8Array> u8 = args[1].As<Uint8Array>();
  char* dest = (char*)u8->Buffer()->Data() + u8->ByteOffset();
  str->WriteUtf8(isolate, dest, size, &written, 
    String::NO_NULL_TERMINATION | String::REPLACE_INVALID_UTF8);
  args.GetReturnValue().Set(Integer::New(isolate, written));
}
*/
/*
void lo::Utf8EncodeInto(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  int chars_written = 0;
  //int size = str->Utf8Length(isolate);
  Local<Uint8Array> u8 = args[1].As<Uint8Array>();
  char* dest = (char*)u8->Buffer()->Data() + u8->ByteOffset();
  int written = str->WriteUtf8(isolate, dest, -1, &chars_written, 
    String::NO_NULL_TERMINATION | String::HINT_MANY_WRITES_EXPECTED);
  args.GetReturnValue().Set(Integer::New(isolate, written));
}

int32_t lo::fastUtf8EncodeInto (void* p, struct FastOneByteString* 
  const p_str, uint64_t* p_buf) {
  memcpy(p_buf, p_str->data, p_str->length);
  return p_str->length;
}
*/
void lo::Utf8EncodeInto(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  if (str->IsOneByte()) {
    uint8_t* dest = reinterpret_cast<uint8_t*>(Local<Integer>::Cast(args[1])->Value());
#if LO_V8_STRING_WRITE_V2
    size_t written = str->Length();
    str->WriteOneByteV2(isolate, 0, written, dest, String::WriteFlags::kNullTerminate);
#else
    int written = str->WriteOneByte(isolate, dest, 0, str->Length());
#endif
    args.GetReturnValue().Set(Integer::New(isolate, written));
    return;
  }
  char* dest = reinterpret_cast<char*>(Local<Integer>::Cast(args[1])->Value());
#if LO_V8_STRING_WRITE_V2
  size_t written;
  str->WriteUtf8V2(isolate, dest, -1, String::WriteFlags::kNullTerminate, &written);
#else
  int written = str->WriteUtf8(isolate, dest, -1, nullptr);
#endif
  args.GetReturnValue().Set(Integer::New(isolate, written));
}

int32_t lo::fastUtf8EncodeInto (void* p, struct FastOneByteString* 
  const p_str, void* p_buf) {
  memcpy(p_buf, p_str->data, p_str->length);
  return p_str->length;
}

void lo::Utf8EncodeIntoAtOffset(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  uint32_t off = Local<Integer>::Cast(args[2])->Value();
  //int size = str->Utf8Length(isolate);
  char* dest = reinterpret_cast<char*>(Local<Integer>::Cast(args[1])->Value()) + off;
//  Local<Uint8Array> u8 = args[1].As<Uint8Array>();
//  char* dest = (char*)u8->Buffer()->Data() + off;
#if LO_V8_STRING_WRITE_V2
  size_t written;
  str->WriteUtf8V2(isolate, dest, -1, String::WriteFlags::kNone, &written);
#else
  int written = str->WriteUtf8(isolate, dest, -1, nullptr, String::NO_NULL_TERMINATION);
#endif
  args.GetReturnValue().Set(Integer::New(isolate, written));
}

/*
void lo::Utf8EncodeIntoAtOffset(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  uint32_t off = Local<Integer>::Cast(args[2])->Value();
  if (str->IsOneByte()) {
    int size = str->Length();
    Local<Uint8Array> u8 = args[1].As<Uint8Array>();
    uint8_t* dest = (uint8_t*)u8->Buffer()->Data() + off;
    int written = str->WriteOneByte(isolate, dest, 0, size, 
      String::NO_NULL_TERMINATION);
    args.GetReturnValue().Set(Integer::New(isolate, written));
    return;
  }
  int written = 0;
  int size = str->Utf8Length(isolate);
  Local<Uint8Array> u8 = args[1].As<Uint8Array>();
  char* dest = (char*)u8->Buffer()->Data() + off;
  str->WriteUtf8(isolate, dest, size, &written, 
    String::NO_NULL_TERMINATION | String::HINT_MANY_WRITES_EXPECTED);
//    String::NO_NULL_TERMINATION | String::REPLACE_INVALID_UTF8);
  args.GetReturnValue().Set(Integer::New(isolate, written));
}
*/

int32_t lo::fastUtf8EncodeIntoAtOffset (void* p, struct FastOneByteString* 
  const p_str, uint64_t* p_buf, uint32_t off) {
  uint8_t* dest = (uint8_t*)p_buf + off;
  memcpy(dest, p_str->data, p_str->length);
  return p_str->length;
}

void lo::GetIsolateStartAddress(const FunctionCallbackInfo<Value> &args) {
  Local<ArrayBuffer> ab = args[0].As<Uint32Array>()->Buffer();
  ((void**)ab->Data())[0] = (void*)&lo_start_isolate;
}

void lo::Print(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  if (args[0].IsEmpty()) return;
  String::Utf8Value str(isolate, args[0]);
  fprintf(stdout, "%s", *str);
}

void lo::RunScript(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  TryCatch try_catch(isolate);
  Local<String> source = args[0].As<String>();
  Local<String> path = args[1].As<String>();
  Local<v8::PrimitiveArray> opts =
      v8::PrimitiveArray::New(isolate, 1);
  opts->Set(isolate, 0, v8::Number::New(isolate, 1));
  ScriptOrigin baseorigin(
    path, // resource name
    0, // line offset
    0,  // column offset
    false, // is shared cross-origin
    -1,  // script id
    Local<Value>(), // source map url
    false, // is opaque
    false, // is wasm
    false, // is module
    opts);
  ScriptCompiler::Source basescript(source, baseorigin);
  Local<Script> script;
  bool ok = ScriptCompiler::Compile(context, &basescript).ToLocal(&script);
  if (!ok) {
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }
  MaybeLocal<Value> result = script->Run(context);
  if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
    try_catch.ReThrow();
    return;
  }
  args.GetReturnValue().Set(result.ToLocalChecked());
}

void lo::Os(const FunctionCallbackInfo<Value> &args) {
#ifdef __MACH__
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    (uint8_t*)"mac", NewStringType::kInternalized).ToLocalChecked());
#elif defined(_WIN64)
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    (uint8_t*)"win", NewStringType::kInternalized).ToLocalChecked());
#else
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    (uint8_t*)"linux", NewStringType::kInternalized).ToLocalChecked());
#endif
}

void lo::Arch(const FunctionCallbackInfo<Value> &args) {
#ifdef __MACH__
  #ifdef __x86_64__
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    (uint8_t*)"x64", NewStringType::kInternalized).ToLocalChecked());
  #else
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    (uint8_t*)"arm64", NewStringType::kInternalized).ToLocalChecked());
  #endif
#elif defined(_WIN64)
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    (uint8_t*)"x64", NewStringType::kInternalized).ToLocalChecked());
#else
  #ifdef __x86_64__
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    (uint8_t*)"x64", NewStringType::kInternalized).ToLocalChecked());
  #else
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    (uint8_t*)"arm64", NewStringType::kInternalized).ToLocalChecked());
  #endif
#endif
}

void lo::Exit(const FunctionCallbackInfo<Value> &args) {
  int32_t status = Local<Integer>::Cast(args[0])->Value();
  exit(status);
}

void lo::GetLoCallbackAddress(const FunctionCallbackInfo<Value> &args) {
  Local<ArrayBuffer> ab = args[0].As<Uint32Array>()->Buffer();
  ((void**)ab->Data())[0] = (void*)&lo_callback;
}

/**
 * fill the provided buffer with random bytes
 * 
 * we can just use /dev/urandom here, like v8 already does, or come up
 * with something better. it would be nice if we could do this from the
 * JS side, but that doesn't seem possible right now
 * 
 * @param buffer Write random bytes in here.
 * @param length Write this number of random bytes, no more, no less.
 */
bool EntropySource(unsigned char* buffer, size_t length) {
#ifdef _WIN32
// https://learn.microsoft.com/en-us/windows/win32/api/Bcrypt/nf-bcrypt-bcryptgenrandom
  NTSTATUS status = BCryptGenRandom(NULL, buffer, length, BCRYPT_USE_SYSTEM_PREFERRED_RNG);
  if (status != 0) return false;
  return true;
#else
  if (random_fd == -1) random_fd = open("/dev/urandom", O_RDONLY);
  size_t bytes = read(random_fd, buffer, length);
  if (bytes != length) return false;
  return true;
#endif
}

void EnvironSlow(const FunctionCallbackInfo<Value> &args) {
  args.GetReturnValue().Set(Number::New(args.GetIsolate(), reinterpret_cast<uint64_t>(environ)));
}

void lo::Setup(
    int* argc, 
    char** argv,
    const char* v8flags,
    int v8_threads,
    int v8flags_from_commandline) {
  // create the v8 platform
  platform = 
    v8::platform::NewDefaultPlatform(v8_threads, 
      v8::platform::IdleTaskSupport::kDisabled, 
      v8::platform::InProcessStackDumping::kDisabled, nullptr);
  V8::InitializePlatform(platform.get());
  // set the v8 flags from the internally defined ones
  V8::SetFlagsFromString(v8flags);
  // then any flags specified on command line will override these, if we 
  // allow this
  if (v8flags_from_commandline == 1) {
    V8::SetFlagsFromCommandLine(argc, argv, true);
  }
  // V8 requires an entropy source - by default it opens /dev/urandom multiple
  // times on startup, which we want to avoid. so we need to see if we can
  // find a more efficient way of providing entropy at startup
  V8::SetEntropySource(EntropySource);
  V8::Initialize();
  V8::InitializeICU();
}

void lo::Init(Isolate* isolate, Local<ObjectTemplate> target) {
  Local<ObjectTemplate> version = ObjectTemplate::New(isolate);
  SET_VALUE(isolate, version, RUNTIME, String::NewFromUtf8Literal(isolate, 
    VERSION));
  SET_VALUE(isolate, version, "v8", String::NewFromUtf8(isolate, 
    V8::GetVersion()).ToLocalChecked());
  SET_MODULE(isolate, target, "version", version);
  SET_METHOD(isolate, target, "print", Print);
  SET_METHOD(isolate, target, "nextTick", NextTick);
  SET_METHOD(isolate, target, "runMicroTasks", RunMicroTasks);
  SET_METHOD(isolate, target, "pumpMessageLoop", PumpMessageLoop);
  SET_METHOD(isolate, target, "arch", Arch);
  SET_METHOD(isolate, target, "os", Os);
  SET_METHOD(isolate, target, "exit", Exit);
  SET_METHOD(isolate, target, "builtins", Builtins);
  SET_METHOD(isolate, target, "builtin", Builtin);
  SET_METHOD(isolate, target, "libraries", Libraries);
  SET_METHOD(isolate, target, "library", Library);
  SET_METHOD(isolate, target, "setModuleCallbacks", SetModuleCallbacks);
  SET_METHOD(isolate, target, "loadModule", LoadModule);
  SET_METHOD(isolate, target, "unloadModule", UnloadModule);
  SET_METHOD(isolate, target, "evaluateModule", EvaluateModule);
  SET_METHOD(isolate, target, "isolate_start_address", GetIsolateStartAddress);
  SET_METHOD(isolate, target, "lo_callback_address", GetLoCallbackAddress);
  SET_METHOD(isolate, target, "latin1Decode", Latin1Decode);
  SET_METHOD(isolate, target, "utf8Decode", Utf8Decode);
  SET_METHOD(isolate, target, "utf8Encode", Utf8Encode);
  SET_METHOD(isolate, target, "latin1Encode", latin1Encode);
  SET_METHOD(isolate, target, "wrapMemory", WrapMemory);
  SET_METHOD(isolate, target, "wrapMemoryShared", WrapMemoryShared);
  SET_METHOD(isolate, target, "unwrapMemory", UnWrapMemory);
  SET_METHOD(isolate, target, "getAddress", GetAddress);
  SET_METHOD(isolate, target, "setFlags", SetFlags);
  SET_METHOD(isolate, target, "get_meta", GetMeta);
  SET_METHOD(isolate, target, "heap_usage", HeapUsage);
  SET_METHOD(isolate, target, "shm_usage", SharedMemoryUsage);
  SET_METHOD(isolate, target, "environ", EnvironSlow);
  SET_METHOD(isolate, target, "runScript", RunScript);
  SET_METHOD(isolate, target, "registerCallback", RegisterCallback);
  SET_FAST_METHOD(isolate, target, "utf8EncodeIntoAtOffset",
    &pFutf8encodeintoatoffset, Utf8EncodeIntoAtOffset);
  SET_FAST_METHOD(isolate, target, "hrtime", &pFhrtime, HRTime);
  SET_FAST_METHOD(isolate, target, "utf8Length", &pFutf8length, Utf8Length);
  SET_FAST_METHOD(isolate, target, "utf8EncodeInto", &pFutf8encodeinto,
    Utf8EncodeInto);
  SET_FAST_METHOD(isolate, target, "readMemory", &pFreadmemory, ReadMemory);
  // OK
  SET_FAST_METHOD(isolate, target, "readMemoryAtOffset", &pFreadmemoryatoffset,
    ReadMemoryAtOffset);
  SET_FAST_PROP(isolate, target, "errno", &pFerrnoget, GetErrno, &pFerrnoset,
    SetErrno);
}

void lo::InitSnapshot(Isolate* isolate, Local<ObjectTemplate> target) {
  Local<ObjectTemplate> version = ObjectTemplate::New(isolate);
  SET_VALUE(isolate, version, RUNTIME, String::NewFromUtf8Literal(isolate, 
    VERSION));
  SET_VALUE(isolate, version, "v8", String::NewFromUtf8(isolate, 
    V8::GetVersion()).ToLocalChecked());
  SET_MODULE(isolate, target, "version", version);
  SET_METHOD(isolate, target, "print", Print);
  SET_METHOD(isolate, target, "nextTick", NextTick);
  SET_METHOD(isolate, target, "runMicroTasks", RunMicroTasks);
  SET_METHOD(isolate, target, "pumpMessageLoop", PumpMessageLoop);
  SET_METHOD(isolate, target, "arch", Arch);
  SET_METHOD(isolate, target, "os", Os);
  SET_METHOD(isolate, target, "exit", Exit);
  SET_METHOD(isolate, target, "builtins", Builtins);
  SET_METHOD(isolate, target, "builtin", Builtin);
  SET_METHOD(isolate, target, "libraries", Libraries);
  SET_METHOD(isolate, target, "library", Library);
  SET_METHOD(isolate, target, "setModuleCallbacks", SetModuleCallbacks);
  SET_METHOD(isolate, target, "loadModule", LoadModule);
  SET_METHOD(isolate, target, "unloadModule", UnloadModule);
  SET_METHOD(isolate, target, "evaluateModule", EvaluateModule);
  SET_METHOD(isolate, target, "isolate_start_address", GetIsolateStartAddress);
  SET_METHOD(isolate, target, "lo_callback_address", GetLoCallbackAddress);
  SET_METHOD(isolate, target, "latin1Decode", Latin1Decode);
  SET_METHOD(isolate, target, "utf8Decode", Utf8Decode);
  SET_METHOD(isolate, target, "utf8Encode", Utf8Encode);
  SET_METHOD(isolate, target, "latin1Encode", latin1Encode);
  SET_METHOD(isolate, target, "wrapMemory", WrapMemory);
  SET_METHOD(isolate, target, "wrapMemoryShared", WrapMemoryShared);
  SET_METHOD(isolate, target, "unwrapMemory", UnWrapMemory);
  SET_METHOD(isolate, target, "getAddress", GetAddress);
  SET_METHOD(isolate, target, "setFlags", SetFlags);
  SET_METHOD(isolate, target, "get_meta", GetMeta);
  SET_METHOD(isolate, target, "heap_usage", HeapUsage);
  SET_METHOD(isolate, target, "shm_usage", SharedMemoryUsage);
  SET_METHOD(isolate, target, "environ", EnvironSlow);
  SET_METHOD(isolate, target, "runScript", RunScript);
  SET_METHOD(isolate, target, "registerCallback", RegisterCallback);
  SET_METHOD(isolate, target, "hrtime", HRTime);
  SET_METHOD(isolate, target, "utf8EncodeIntoAtOffset", Utf8EncodeIntoAtOffset);
  SET_METHOD(isolate, target, "utf8Length", Utf8Length);
  SET_METHOD(isolate, target, "utf8EncodeInto", Utf8EncodeInto);
  SET_METHOD(isolate, target, "readMemory", ReadMemory);
  SET_METHOD(isolate, target, "readMemoryAtOffset", ReadMemoryAtOffset);
  SET_PROP(isolate, target, "errno", GetErrno, SetErrno);
}

// C/FFI api for managing isolates
void lo_setup(int* argc, char** argv,
  const char* v8flags, int v8_threads, int v8flags_from_commandline) {
  lo::Setup(argc, argv, v8flags, v8_threads, v8flags_from_commandline);
}

int lo_create_isolate (int argc, char** argv, 
  const char* main, unsigned int main_len,
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname,
  int cleanup, int onexit, void* startup_data) {
//  const v8::StartupData* data = (const v8::StartupData*) startup_data;
  return lo::CreateIsolate(argc, argv, main, main_len, js, js_len, 
  buf, buflen, fd, start, globalobj, scriptname, cleanup, onexit, startup_data);
}

int lo_context_size () {
  return sizeof(struct isolate_context);
}

void lo_create_isolate_context (int argc, char** argv, 
  const char* main, unsigned int main_len,
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname,
  int cleanup, int onexit, void* startup_data, struct isolate_context* ctx) {
  ctx->argc = argc;
  ctx->argv = argv;
  ctx->argv = (char**)calloc(argc + 1, sizeof(char*));
  for (int i = 0; i < argc; i++) {
    ctx->argv[i] = (char*)calloc(1, strnlen(argv[i], 4096));
    memcpy(ctx->argv[i], argv[i], strnlen(argv[i], 4096));
  }
  ctx->argv[argc] = NULL;
  ctx->main = (char*)calloc(1, main_len);
  memcpy(ctx->main, main, main_len);
  ctx->main_len = main_len;
  ctx->js = (char*)calloc(1, js_len);
  memcpy(ctx->js, js, js_len);
  ctx->js_len = js_len;
  ctx->buf = buf;
  ctx->buflen = buflen;
  ctx->fd = fd;
  ctx->start = start;
  ctx->globalobj = (char*)calloc(1, strnlen(globalobj, 4096));
  memcpy(ctx->globalobj, globalobj, strnlen(globalobj, 4096));
  ctx->scriptname = (char*)calloc(1, strnlen(scriptname, 4096));
  memcpy(ctx->scriptname, scriptname, strnlen(scriptname, 4096));
  ctx->cleanup = cleanup;
  ctx->onexit = onexit;
  ctx->startup_data = startup_data;
}

// todo: lo_destroy_isolate_context
void lo_start_isolate (void* ptr) {
  struct isolate_context* ctx = (struct isolate_context*)ptr;
  ctx->rc = lo_create_isolate(ctx->argc, ctx->argv, ctx->main, ctx->main_len,
    ctx->js, ctx->js_len, ctx->buf, ctx->buflen, ctx->fd, ctx->start,
    ctx->globalobj, ctx->scriptname, ctx->cleanup, ctx->onexit, 
    ctx->startup_data);
}

void lo_destroy_isolate_context (struct isolate_context* ctx) {
//  if (ctx->startup_data != NULL) {
//    Isolate* isolate = (Isolate*)ctx->startup_data;
//    cleanupIsolate(isolate);
//  }
//  free(ctx);
  free(ctx->main);
  free(ctx->js);
  for (int i = 0; i < ctx->argc; i++) {
    free(ctx->argv[i]);
  }
  free(ctx->argv);
  free(ctx->globalobj);
  free(ctx->scriptname);
}

// generic callback used to trampoline ffi callbacks back into JS
void lo_callback (exec_info* info) {
  Isolate* isolate = info->isolate;
  if (isolate == Isolate::GetCurrent()) {
    HandleScope scope(isolate);
#if LO_V8_CALL_HAS_ISOLATE_OVERLOAD
    info->js_fn.Get(isolate)->Call(isolate, isolate->GetCurrentContext(),
      v8::Null(isolate), 0, 0).ToLocalChecked();
#else
    info->js_fn.Get(isolate)->Call(isolate->GetCurrentContext(),
      v8::Null(isolate), 0, nullptr).ToLocalChecked();
#endif
  }
}

// trampoline callback which may be called async from another thread
void lo_async_callback (exec_info* info, callback_state* state) {
  uint64_t* slot = (uint64_t*)info;
/*
  fprintf(stderr, "state.cur    %i\n", state->current);
  fprintf(stderr, "state.max    %i\n", state->max_contexts);
  fprintf(stderr, "tid          %lu\n", pthread_self());
  fprintf(stderr, "isol         %lu\n", (uint64_t)info->isolate);
  fprintf(stderr, "nargs        %lu\n", slot[3]);
  fprintf(stderr, "arg1         %lu\n", slot[4]);
  fprintf(stderr, "arg2         %lu\n", slot[5]);
  fprintf(stderr, "arg3         %lu\n", slot[6]);
  fprintf(stderr, "arg4         %lu\n", slot[7]);
  fprintf(stderr, "arg5         %lu\n", slot[8]);
  fprintf(stderr, "rv           %lu\n", slot[2]);
*/
  int size = sizeof(struct exec_info) + (8 * slot[3]);
  state->contexts[state->current] = (struct exec_info*)calloc(1, size);
//  state->contexts[state->current] = info;
  memcpy((void*)state->contexts[state->current], (void*)info, size);
  state->current = (state->current + 1) % state->max_contexts;
/*


// https://github.com/eldipa/loki/blob/master/loki/queue.c
//  v8::Unlocker unlocker(isolate);  
  v8::Locker lock(isolate);
  v8::Isolate::Scope isolate_scope(isolate);
  isolate->Enter();
//  isolate->EnqueueMicrotask(info->js_fn.Get(isolate));
  Local<Value> argv[1] = { Integer::New(isolate, 1) };
  info->js_fn.Get(isolate)->Call(isolate->GetEnteredOrMicrotaskContext(), 
    v8::Null(isolate), 1, argv).ToLocalChecked();

  isolate->Exit();
*/
}

void lo_shutdown (int cleanup) {
  // if we have the cleanup flag set, clean up memory left behind when isolate
  // exits. this flag should be set if you want to spawn multiple isolates
  // in the same process without memory leaks.
  if (cleanup) {
    V8::Dispose();
    platform.reset();
  }
#ifndef _WIN32
  close(random_fd);
#endif
  builtins.clear();
  modules.clear();
}
