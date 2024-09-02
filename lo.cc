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
using v8::kPromiseRejectAfterResolved;
using v8::kPromiseResolveAfterResolved;
using v8::kPromiseHandlerAddedAfterReject;
using v8::Script;
using v8::HeapSpaceStatistics;
using v8::HeapStatistics;
using v8::BigUint64Array;

// TODO: thread safety
std::map<std::string, lo::builtin*> builtins;
std::map<std::string, lo::register_plugin> modules;
std::unique_ptr<v8::Platform> platform;

#ifndef _WIN64
clock_t clock_id = CLOCK_MONOTONIC;
#endif

struct timespec t;

CTypeInfo cargshrtime[2] = { 
  CTypeInfo(CTypeInfo::Type::kV8Value), 
  CTypeInfo(CTypeInfo::Type::kUint32, CTypeInfo::SequenceType::kIsTypedArray, 
    CTypeInfo::Flags::kNone) 
};
CTypeInfo rchrtime = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo infohrtime = CFunctionInfo(rchrtime, 2, cargshrtime);
CFunction pFhrtime = CFunction((const void*)&lo::fastHRTime, 
  &infohrtime);

CTypeInfo cargsgetaddress[3] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kUint8, 
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone),
  CTypeInfo(CTypeInfo::Type::kUint32, 
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone)
};
CTypeInfo rcgetaddress = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo infogetaddress = CFunctionInfo(rcgetaddress, 3, 
  cargsgetaddress);
CFunction pFgetaddress = CFunction((const void*)&lo::fastGetAddress, 
  &infogetaddress);

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
  CTypeInfo(CTypeInfo::Type::kUint8,
  CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone)
};
CTypeInfo rcutf8encodeinto = CTypeInfo(CTypeInfo::Type::kInt32);
CFunctionInfo infoutf8encodeinto = CFunctionInfo(rcutf8encodeinto, 3, 
  cargsutf8encodeinto);
CFunction pFutf8encodeinto = CFunction((const void*)&lo::fastUtf8EncodeInto, 
  &infoutf8encodeinto);

CTypeInfo cargsutf8encodeintoPtr[3] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kSeqOneByteString),
  CTypeInfo(CTypeInfo::Type::kUint64)
};
CFunctionInfo infoutf8encodeintoPtr = CFunctionInfo(rcutf8encodeinto, 3, 
  cargsutf8encodeintoPtr);
CFunction pFutf8encodeintoPtr = CFunction((const void*)&lo::fastUtf8EncodeIntoPtr, 
  &infoutf8encodeintoPtr);

CTypeInfo cargsutf8encodeintoatoffset[4] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kSeqOneByteString),
  CTypeInfo(CTypeInfo::Type::kUint8,
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone),
  CTypeInfo(CTypeInfo::Type::kUint32)
};
CTypeInfo rcutf8encodeintoatoffset = CTypeInfo(CTypeInfo::Type::kInt32);
CFunctionInfo infoutf8encodeintoatoffset = CFunctionInfo(rcutf8encodeintoatoffset, 4, 
  cargsutf8encodeintoatoffset);
CFunction pFutf8encodeintoatoffset = CFunction((const void*)&lo::fastUtf8EncodeIntoAtOffset, 
  &infoutf8encodeintoatoffset);

CTypeInfo cargsreadmemory[4] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kUint8, 
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone),
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
  CTypeInfo(CTypeInfo::Type::kUint8, 
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone),
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
  if (data.GetEvent() == kPromiseRejectAfterResolved ||
      data.GetEvent() == kPromiseResolveAfterResolved) {
    return;
  }
  Local<Promise> promise = data.GetPromise();
  Isolate* isolate = promise->GetIsolate();
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
  MaybeLocal<Value> result = onUnhandledRejection->Call(context, 
    globalInstance, 1, argv);
  if (result.IsEmpty() && try_catch.HasCaught()) {
    fprintf(stderr, "PromiseRejectCallback: Call\n");
  }
}

MaybeLocal<Module> lo::OnModuleInstantiate(Local<Context> context,
  Local<String> specifier,
  Local<FixedArray> import_assertions, 
  Local<Module> referrer) {

//  printf("OnModuleInstantiate, assertions: %i\n", import_assertions.->.Length());
  Isolate* isolate = context->GetIsolate();
  String::Utf8Value str(isolate, specifier);
  Local<Function> callback = 
    context->GetEmbedderData(2).As<Function>();
  Local<Value> argv[1] = { specifier };
  MaybeLocal<Value> result = callback->Call(context, 
    context->Global(), 1, argv);
  int identity = result.ToLocalChecked()->Uint32Value(context).ToChecked();
  std::map<int, Global<Module>> *module_map = static_cast<std::map<int, Global<Module>>*>(isolate->GetData(0));
  Local<Module> module = (*module_map)[identity].Get(context->GetIsolate());
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

int lo::CreateIsolate(int argc, char** argv, 
  const char* main_src, unsigned int main_len, 
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname, int cleanup,
  int onexit, void* startup_data) {
  Isolate::CreateParams create_params;
  int statusCode = 0;
  create_params.array_buffer_allocator = 
    ArrayBuffer::Allocator::NewDefaultAllocator();
  //create_params.array_buffer_allocator = new SpecialArrayBufferAllocator();
  create_params.embedder_wrapper_type_index = 0;
  create_params.embedder_wrapper_object_index = 1;
  if (startup_data != NULL) {
    create_params.snapshot_blob = (const v8::StartupData*)startup_data;
  }

//  V8::InitializeExternalStartupDataFromFile("./scratch/snaps/foo.bin");

  //create_params.code_event_handler = JitCodeEventHandler;
  //create_params.counter_lookup_callback = CounterLookupCallback;
  //create_params.allow_atomics_wait = false;
  //create_params.only_terminate_in_safe_scope = false;
  create_params.fatal_error_callback = fatalErrorcallback;
  create_params.oom_error_callback = OOMErrorcallback;
  //Isolate *isolate = Isolate::Allocate();
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
/*
    if (!ScriptCompiler::CompileModule(isolate, &basescript, ScriptCompiler::kConsumeCodeCache).ToLocal(&module)) {
      PrintStackTrace(isolate, try_catch);
      return 1;
    }
*/
//    if (!ScriptCompiler::CompileModule(isolate, &basescript, v8::ScriptCompiler::CompileOptions::kConsumeCodeCache).ToLocal(&module)) {
//      PrintStackTrace(isolate, try_catch);
//      return 1;
//    }
//  v8::ScriptCompiler::CreateCodeCache(module->GetUnboundModuleScript());
//  v8::ScriptCompiler::CachedData* cache = v8::ScriptCompiler::CreateCodeCache(module->GetUnboundModuleScript());
//  fprintf(stderr, "source: %i path: %s cache: %i\n", base->Length(), "main", cache->length);


    Maybe<bool> ok2 = module->InstantiateModule(context, 
      lo::OnModuleInstantiate);
    if (ok2.IsNothing()) {
      if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
        try_catch.ReThrow();
      }
      // TODO: cleanup before return
      return 1;
    }
/*
    ScriptCompiler::CachedData* cache = ScriptCompiler::CreateCodeCache(module->GetUnboundModuleScript());
    fprintf(stderr, "%i\n", cache->length);
    int fd = open("script.data", O_WRONLY | O_CREAT, S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH);
    int bytes = write(fd, cache->data, cache->length);
    if (bytes < cache->length) {
      fprintf(stderr, "error\n");
    }
    close(fd);
*/

    module->Evaluate(context).ToLocalChecked();
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
      return 1;
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
void lo::LoadModule(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
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
  ScriptCompiler::Source base(source, baseorigin);
  Local<Module> module;
  bool ok = ScriptCompiler::CompileModule(isolate, &base).ToLocal(&module);
  if (!ok) {
    String::Utf8Value path(args.GetIsolate(), args[1]);
    fprintf(stderr, "Error compiling %s\n", *path);
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }

//  v8::ScriptCompiler::CreateCodeCache(module->GetUnboundModuleScript());
//  v8::ScriptCompiler::CachedData* cache = v8::ScriptCompiler::CreateCodeCache(module->GetUnboundModuleScript());
//  String::Utf8Value path_c(args.GetIsolate(), path);
//  fprintf(stderr, "source: %i path: %s cache: %i\n", source->Length(), *path_c, cache->length);
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
  Local<Array> requests = Array::New(isolate);
  Local<FixedArray> module_requests = module->GetModuleRequests();
  int length = module_requests->Length();
  for (int i = 0; i < length; ++i) {
    Local<ModuleRequest> module_request =
        module_requests->Get(context, i).As<ModuleRequest>();
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
#ifdef __MACH__ // OS X does not have clock_gettime, use clock_get_time
  clock_serv_t cclock;
  mach_timespec_t mts;
  host_get_clock_service(mach_host_self(), CALENDAR_CLOCK, &cclock);
  clock_get_time(cclock, &mts);
  mach_port_deallocate(mach_task_self(), cclock);
  t.tv_sec = mts.tv_sec;
  t.tv_nsec = mts.tv_nsec;
#elif defined(_WIN32)
  // TODO
#else
  if (clock_gettime(clock_id, &t)) return 0;
#endif
  return (t.tv_sec * (uint64_t) 1e9) + t.tv_nsec;
}

void lo::HRTime(const FunctionCallbackInfo<Value> &args) {
  ((uint64_t*)args[0].As<Uint32Array>()->Buffer()->Data())[0] = hrtime();
}

void lo::fastHRTime (void* p, struct FastApiTypedArray* const p_ret) {
  ((uint64_t*)p_ret->data)[0] = hrtime();
}

void lo::GetAddress(const FunctionCallbackInfo<Value> &args) {
  Local<TypedArray> ta = args[0].As<TypedArray>();
  uint8_t* ptr = (uint8_t*)ta->Buffer()->Data() + ta->ByteOffset();
  ((uint64_t*)args[1].As<Uint32Array>()->Buffer()->Data())[0] = (uint64_t)ptr;
}

void lo::fastGetAddress(void* p, struct FastApiTypedArray* const p_buf, 
  struct FastApiTypedArray* const p_ret) {
  ((uint64_t*)p_ret->data)[0] = (uint64_t)p_buf->data;
}

void lo::Utf8Length(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  args.GetReturnValue().Set(args[0].As<String>()->Utf8Length(isolate));
}

int32_t lo::fastUtf8Length (void* p, struct FastOneByteString* const p_str) {
  return p_str->length;
}

void lo::HeapUsage(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  HeapStatistics v8_heap_stats;
  isolate->GetHeapStatistics(&v8_heap_stats);
  Local<BigUint64Array> array = args[0].As<BigUint64Array>();
  uint64_t *fields = static_cast<uint64_t *>(array->Buffer()->Data());
  fields[0] = v8_heap_stats.total_heap_size();
  fields[1] = v8_heap_stats.used_heap_size();
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
  fields[12] = isolate->AdjustAmountOfExternalAllocatedMemory(0);
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
  Local<Uint8Array> u8 = args[0].As<Uint8Array>();
  uint8_t* dest = (uint8_t*)u8->Buffer()->Data() + u8->ByteOffset();
  void* start = reinterpret_cast<void*>(
    (uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t size = Local<Integer>::Cast(args[2])->Value();
  memcpy(dest, start, size);
}

void lo::fastReadMemory (void* p, struct FastApiTypedArray* const p_buf, 
  void* start, uint32_t size) {
  memcpy(p_buf->data, start, size);
}

// todo: version that wraps memory in place with an arraybuffer
void lo::ReadMemoryAtOffset(const FunctionCallbackInfo<Value> &args) {
  Local<Uint8Array> u8 = args[0].As<Uint8Array>();
  uint32_t off = Local<Integer>::Cast(args[3])->Value();
  uint8_t* dest = (uint8_t*)u8->Buffer()->Data() + off;
  void* start = reinterpret_cast<void*>(
    (uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t size = Local<Integer>::Cast(args[2])->Value();
  memcpy(dest, start, size);
}

void lo::fastReadMemoryAtOffset (void* p, struct FastApiTypedArray* const p_buf, 
  void* start, uint32_t size, uint32_t off) {
  uint8_t* ptr = (uint8_t*)p_buf->data + off;
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

void lo::UnWrapMemory(const FunctionCallbackInfo<Value> &args) {
  Local<ArrayBuffer> ab = args[0].As<ArrayBuffer>();
  ab->Detach();
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
    str->WriteOneByte(isolate, static_cast<uint8_t*>(backing->Data()), 0, 
      size, String::NO_NULL_TERMINATION);
    Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
    args.GetReturnValue().Set(Uint8Array::New(ab, 0, size));
    return;
  }
  int written = 0;
  int size = str->Utf8Length(isolate);
  std::unique_ptr<BackingStore> backing = 
    ArrayBuffer::NewBackingStore(isolate, size);
  str->WriteUtf8(isolate, static_cast<char*>(backing->Data()), size, &written, 
    String::NO_NULL_TERMINATION | String::REPLACE_INVALID_UTF8);
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
  const p_str, struct FastApiTypedArray* const p_buf) {
  memcpy(p_buf->data, p_str->data, p_str->length);
  return p_str->length;
}

void lo::Utf8EncodeIntoPtr(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
/*
// this check is expensive and it seems to provide little benefit unless
// we are dealing with flat non unicode strings. need to benchmark further

  if (str->IsOneByte()) {
    uint64_t start64 = (uint64_t)Local<Number>::Cast(args[1])->Value();
    uint8_t* dest = reinterpret_cast<uint8_t*>(start64);
    int written = str->WriteOneByte(isolate, dest, 0, -1, 
      String::NO_NULL_TERMINATION);
    args.GetReturnValue().Set(Integer::New(isolate, written));
  }
*/
  //int chars_written = 0;
//  uint64_t start64 = (uint64_t)Local<Number>::Cast(args[1])->Value();
//  char* dest = reinterpret_cast<char*>(start64);
  char* dest = reinterpret_cast<char*>(Local<Integer>::Cast(args[1])->Value());
  int written = str->WriteUtf8(isolate, dest, -1, nullptr, 
    String::NO_NULL_TERMINATION);
  args.GetReturnValue().Set(Integer::New(isolate, written));
}

int32_t lo::fastUtf8EncodeIntoPtr (void* p, struct FastOneByteString* 
  const p_str, void* p_buf) {
  memcpy(p_buf, p_str->data, p_str->length);
  return p_str->length;
}

void lo::Utf8EncodeIntoAtOffset(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  uint32_t off = Local<Integer>::Cast(args[2])->Value();
  int chars_written = 0;
  //int size = str->Utf8Length(isolate);
  Local<Uint8Array> u8 = args[1].As<Uint8Array>();
  char* dest = (char*)u8->Buffer()->Data() + off;
  int written = str->WriteUtf8(isolate, dest, -1, &chars_written, 
    String::NO_NULL_TERMINATION | String::HINT_MANY_WRITES_EXPECTED);
//    String::NO_NULL_TERMINATION | String::REPLACE_INVALID_UTF8);
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
  const p_str, struct FastApiTypedArray* const p_buf, uint32_t off) {
  uint8_t* dest = (uint8_t*)p_buf->data + off;
  memcpy(dest, p_str->data, p_str->length);
  return p_str->length;
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

// keep the /dev/urandom file open for lifetime of process
int random_fd = -1;

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
  if (random_fd == -1) random_fd = open("/dev/urandom", O_RDONLY);
  //todo check return
  size_t bytes = read(random_fd, buffer, length);
  if (bytes != length) return false;
  return true;
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
  SET_FAST_METHOD(isolate, target, "hrtime", &pFhrtime, HRTime);
  SET_METHOD(isolate, target, "nextTick", NextTick);
  SET_METHOD(isolate, target, "runMicroTasks", RunMicroTasks);
  SET_METHOD(isolate, target, "pumpMessageLoop", PumpMessageLoop);
  SET_METHOD(isolate, target, "arch", Arch);
  SET_METHOD(isolate, target, "os", Os);
  SET_METHOD(isolate, target, "exit", Exit);
  SET_FAST_PROP(isolate, target, "errno", &pFerrnoget, GetErrno, &pFerrnoset, 
    SetErrno);

  SET_METHOD(isolate, target, "builtins", Builtins);
  SET_METHOD(isolate, target, "builtin", Builtin);
  SET_METHOD(isolate, target, "libraries", Libraries);
  SET_METHOD(isolate, target, "library", Library);
  SET_METHOD(isolate, target, "setModuleCallbacks", SetModuleCallbacks);
  SET_METHOD(isolate, target, "loadModule", LoadModule);
  SET_METHOD(isolate, target, "evaluateModule", EvaluateModule);

  SET_METHOD(isolate, target, "latin1Decode", Latin1Decode);
  SET_METHOD(isolate, target, "utf8Decode", Utf8Decode);
  SET_METHOD(isolate, target, "utf8Encode", Utf8Encode);
  //SET_METHOD(isolate, target, "utf8EncodeInto", Utf8EncodeInto);

  SET_FAST_METHOD(isolate, target, "utf8Length", &pFutf8length, Utf8Length);
  SET_FAST_METHOD(isolate, target, "utf8EncodeInto", &pFutf8encodeinto, 
    Utf8EncodeInto);

  SET_FAST_METHOD(isolate, target, "utf8EncodeIntoPtr", &pFutf8encodeintoPtr, 
    Utf8EncodeIntoPtr);

  SET_FAST_METHOD(isolate, target, "utf8EncodeIntoAtOffset", 
    &pFutf8encodeintoatoffset, Utf8EncodeIntoAtOffset);

  SET_METHOD(isolate, target, "wrapMemory", WrapMemory);
  SET_METHOD(isolate, target, "unwrapMemory", UnWrapMemory);
  SET_FAST_METHOD(isolate, target, "getAddress", &pFgetaddress, GetAddress);
  SET_FAST_METHOD(isolate, target, "readMemory", &pFreadmemory, ReadMemory);
  SET_FAST_METHOD(isolate, target, "readMemoryAtOffset", &pFreadmemoryatoffset, 
    ReadMemoryAtOffset);

  SET_METHOD(isolate, target, "setFlags", SetFlags);
  SET_METHOD(isolate, target, "get_meta", GetMeta);
  SET_METHOD(isolate, target, "heap_usage", HeapUsage);
  
  SET_METHOD(isolate, target, "runScript", RunScript);
  SET_METHOD(isolate, target, "registerCallback", RegisterCallback);
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
  free(ctx);
}

// generic callback used to trampoline ffi callbacks back into JS
void lo_callback (exec_info* info) {
  Isolate* isolate = info->isolate;
  HandleScope scope(isolate);
  info->js_fn.Get(isolate)->Call(isolate->GetCurrentContext(), 
    v8::Null(isolate), 0, 0).ToLocalChecked();
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
  close(random_fd);
  builtins.clear();
  modules.clear();
}
