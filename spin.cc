#include "spin.h"

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

// TODO: thread safety
std::map<std::string, spin::builtin*> builtins;
std::map<std::string, spin::register_plugin> modules;
std::map<int, Global<Module>> module_map;

clock_t clock_id = CLOCK_MONOTONIC;
struct timespec t;

CTypeInfo cargshrtime[2] = { 
  CTypeInfo(CTypeInfo::Type::kV8Value), 
  CTypeInfo(CTypeInfo::Type::kUint32, CTypeInfo::SequenceType::kIsTypedArray, 
    CTypeInfo::Flags::kNone) 
};
CTypeInfo rchrtime = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo infohrtime = CFunctionInfo(rchrtime, 2, cargshrtime);
CFunction pFhrtime = CFunction((const void*)&spin::fastHRTime, 
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
CFunction pFgetaddress = CFunction((const void*)&spin::fastGetAddress, 
  &infogetaddress);

CTypeInfo cargsutf8length[2] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kSeqOneByteString)
};
CTypeInfo rcutf8length = CTypeInfo(CTypeInfo::Type::kInt32);
CFunctionInfo infoutf8length = CFunctionInfo(rcutf8length, 2, 
  cargsutf8length);
CFunction pFutf8length = CFunction((const void*)&spin::fastUtf8Length, 
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
CFunction pFutf8encodeinto = CFunction((const void*)&spin::fastUtf8EncodeInto, 
  &infoutf8encodeinto);

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
CFunction pFutf8encodeintoatoffset = CFunction((const void*)&spin::fastUtf8EncodeIntoAtOffset, 
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
CFunction pFreadmemory = CFunction((const void*)&spin::fastReadMemory, 
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
CFunction pFreadmemoryatoffset = CFunction((const void*)&spin::fastReadMemoryAtOffset, 
  &inforeadmemoryatoffset);

CTypeInfo cargserrnoset[2] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
  CTypeInfo(CTypeInfo::Type::kInt32)
};
CTypeInfo rcerrnoset = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo infoerrnoset = CFunctionInfo(rcerrnoset, 2, 
  cargserrnoset);
CFunction pFerrnoset = CFunction((const void*)&spin::fastSetErrno, 
  &infoerrnoset);
CTypeInfo cargserrnoget[1] = {
  CTypeInfo(CTypeInfo::Type::kV8Value)
};
CTypeInfo rcerrnoget = CTypeInfo(CTypeInfo::Type::kInt32);
CFunctionInfo infoerrnoget = CFunctionInfo(rcerrnoget, 1, 
  cargserrnoget);
CFunction pFerrnoget = CFunction((const void*)&spin::fastGetErrno, 
  &infoerrnoget);

// v8 isolate callbacks
size_t spin::nearHeapLimitCallback(void* data, size_t current_heap_limit,
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
void spin::builtins_add (const char* name, const char* source, 
  unsigned int size) {
  struct builtin* b = new builtin();
  b->size = size;
  b->source = source;
  builtins[name] = b;
}

void spin::modules_add (const char* name, register_plugin plugin_handler) {
  modules[name] = plugin_handler;
}

void spin::FreeMemory(void* buf, size_t length, void* data) {
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

void spin::SET_PROP(Isolate *isolate, Local<ObjectTemplate> 
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

void spin::SET_METHOD(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, FunctionCallback callback) {
  recv->Set(String::NewFromUtf8(isolate, name, 
    NewStringType::kInternalized).ToLocalChecked(), 
    FunctionTemplate::New(isolate, callback));
}

void spin::SET_MODULE(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, Local<ObjectTemplate> module) {
  recv->Set(String::NewFromUtf8(isolate, name, 
    NewStringType::kInternalized).ToLocalChecked(), 
    module);
}

void spin::SET_VALUE(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, Local<Value> value) {
  recv->Set(String::NewFromUtf8(isolate, name, 
    NewStringType::kInternalized).ToLocalChecked(), 
    value);
}

void spin::SET_FAST_METHOD(Isolate* isolate, Local<ObjectTemplate> 
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

void spin::SET_FAST_PROP(Isolate* isolate, Local<ObjectTemplate> 
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

void spin::PrintStackTrace(Isolate* isolate, const TryCatch& try_catch) {
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

void spin::PromiseRejectCallback(PromiseRejectMessage data) {
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

MaybeLocal<Module> spin::OnModuleInstantiate(Local<Context> context,
  Local<String> specifier,
  Local<FixedArray> import_assertions, 
  Local<Module> referrer) {
  Isolate* isolate = context->GetIsolate();
  String::Utf8Value str(isolate, specifier);
  Local<Function> callback = 
    context->GetEmbedderData(2).As<Function>();
  Local<Value> argv[1] = { specifier };
  MaybeLocal<Value> result = callback->Call(context, 
    context->Global(), 1, argv);
  int identity = result.ToLocalChecked()->Uint32Value(context).ToChecked();
  Local<Module> module = module_map[identity].Get(context->GetIsolate());
  return module;
}

MaybeLocal<Promise> OnDynamicImport(Local<Context> context,
  Local<Data> host_defined_options, Local<Value> resource_name,
  Local<String> specifier,Local<FixedArray> import_assertions) {
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

int spin::CreateIsolate(int argc, char** argv, 
  const char* main_src, unsigned int main_len, 
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname, int cleanup,
  int onexit, const v8::StartupData* startup_data) {
  Isolate::CreateParams create_params;
  int statusCode = 0;
  create_params.array_buffer_allocator = 
    ArrayBuffer::Allocator::NewDefaultAllocator();
  //create_params.array_buffer_allocator = new SpecialArrayBufferAllocator();
  create_params.embedder_wrapper_type_index = 0;
  create_params.embedder_wrapper_object_index = 1;
  //create_params.snapshot_blob = startup_data;
  //create_params.code_event_handler = JitCodeEventHandler;
  //create_params.counter_lookup_callback = CounterLookupCallback;
  //create_params.allow_atomics_wait = false;
  //create_params.only_terminate_in_safe_scope = false;
  create_params.fatal_error_callback = fatalErrorcallback;
  create_params.oom_error_callback = OOMErrorcallback;
  Isolate *isolate = Isolate::Allocate();
  {
    //v8::Locker locker(isolate);
    //isolate->Enter();
    // we can call Isolate::SetData and Isolate::GetData before we initialize
    Isolate::Initialize(isolate, create_params);
    Isolate::Scope isolate_scope(isolate);
    HandleScope handle_scope(isolate);
    // TODO: we shoudl expose these to embedder in some way
    //isolate->SetRAILMode(v8::RAILMode::PERFORMANCE_RESPONSE);
    isolate->SetCaptureStackTraceForUncaughtExceptions(true, 1000, 
      StackTrace::kDetailed);
    //isolate->AddNearHeapLimitCallback(spin::nearHeapLimitCallback, 0);
    //isolate->SetAbortOnUncaughtExceptionCallback(AbortOnUncaughtException);
    isolate->SetPromiseRejectCallback(PromiseRejectCallback);
    isolate->SetHostImportModuleDynamicallyCallback(OnDynamicImport);
    //isolate->SetMicrotasksPolicy(v8::MicrotasksPolicy::kExplicit);
    //isolate->SetEventLogger(LogEvent);
    //isolate->SetFatalErrorHandler(fatalErrorcallback);
    //isolate->SetOOMErrorHandler(OOMErrorcallback);
    //isolate->EnableMemorySavingsMode();
    //isolate->SetData(0, 0);
    Local<ObjectTemplate> global = ObjectTemplate::New(isolate);
    Local<ObjectTemplate> runtime = ObjectTemplate::New(isolate);
    //runtime->SetImmutableProto();
    spin::Init(isolate, runtime);
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
    if (js_len > 0) {
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
        PrimitiveArray::New(isolate, spin::HostDefinedOptions::kLength);
    opts->Set(isolate, spin::HostDefinedOptions::kType, 
      Number::New(isolate, spin::ScriptType::kModule));
    ScriptOrigin baseorigin(
      isolate,
      String::NewFromUtf8(isolate, scriptname, NewStringType::kInternalized, 
      strnlen(scriptname, 1024)).ToLocalChecked(),
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
    base = String::NewFromUtf8(isolate, main_src, NewStringType::kNormal, 
      main_len).ToLocalChecked();
    ScriptCompiler::Source basescript(base, baseorigin);
    Local<Module> module;
    if (!ScriptCompiler::CompileModule(isolate, &basescript).ToLocal(&module)) {
      PrintStackTrace(isolate, try_catch);
      return 1;
    }
    Maybe<bool> ok2 = module->InstantiateModule(context, 
      spin::OnModuleInstantiate);
    if (ok2.IsNothing()) {
      if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
        try_catch.ReThrow();
      }
      // TODO: cleanup before return
      return 1;
    }
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
        MaybeLocal<Value> result = onExit->Call(context, globalInstance, 0, 
          argv);
        if (!result.IsEmpty()) {
          statusCode = result.ToLocalChecked()->Uint32Value(context).ToChecked();
        }
        if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
          spin::PrintStackTrace(isolate, try_catch);
          return 2;
        }
        statusCode = result.ToLocalChecked()->Uint32Value(context).ToChecked();
      }
    }
  }
  //isolate->Exit();
  if (cleanup == 1) {
    cleanupIsolate(isolate);
    delete create_params.array_buffer_allocator;
    isolate = nullptr;
  }
  return statusCode;
}

int spin::CreateIsolate(int argc, char** argv, const char* main_src, 
  unsigned int main_len, uint64_t start, const char* globalobj, int cleanup,
  int onexit, const v8::StartupData* startup_data) {
  return CreateIsolate(argc, argv, main_src, main_len, NULL, 0, NULL, 0, 0, 
    start, globalobj, "main.js", cleanup, onexit, startup_data);
}

// TODO: in libraries, the init code is very slow and it never frees the
// fastcall structures it creates
// TODO: this is very slow
void spin::Library(const FunctionCallbackInfo<Value> &args) {
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
void spin::Builtin(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  String::Utf8Value name(isolate, args[0]);
  auto iter = builtins.find(*name);
  if (iter == builtins.end()) {
    args.GetReturnValue().Set(Null(isolate));
    return;
  }
  spin::builtin* b = (iter->second);
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

void spin::RunMicroTasks(const FunctionCallbackInfo<Value> &args) {
  args.GetIsolate()->PerformMicrotaskCheckpoint();
  //TODO: args.GetIsolate()->SetMicrotasksPolicy()
}

void spin::NextTick(const FunctionCallbackInfo<Value>& args) {
  args.GetIsolate()->EnqueueMicrotask(args[0].As<Function>());
}

void spin::RegisterCallback(const FunctionCallbackInfo<Value>& args) {
  struct exec_info* info = reinterpret_cast<struct exec_info*>(
    (uint64_t)Local<Integer>::Cast(args[0])->Value());
  Local<Function> fn = args[1].As<Function>();
  Isolate* isolate = args.GetIsolate();
  info->isolate = isolate;
//  info->js_ctx.Reset(isolate, Global<Context>(isolate, isolate->GetCurrentContext()));
  info->js_fn.Reset(isolate, Global<Function>(isolate, fn));
}

// TODO: UnregisterCallback

void spin::EvaluateModule(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  int identity = Local<Integer>::Cast(args[0])->Value();
  Local<Module> module = module_map[identity].Get(isolate);
  if (module->GetStatus() >= 4) {
    args.GetReturnValue().Set(module->GetModuleNamespace().As<Promise>());
    return;
  }
  Maybe<bool> result = module->InstantiateModule(context, 
    spin::OnModuleInstantiate);
  if (result.IsNothing()) {
    printf("\nCan't instantiate module.\n");
    return;
  }
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
void spin::LoadModule(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  TryCatch try_catch(isolate);
  Local<String> source = args[0].As<String>();
  Local<String> path = args[1].As<String>();
  Local<PrimitiveArray> opts =
      PrimitiveArray::New(isolate, spin::HostDefinedOptions::kLength);
  opts->Set(isolate, spin::HostDefinedOptions::kType,
                            Number::New(isolate, spin::ScriptType::kModule));
  ScriptOrigin baseorigin(isolate,
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
    printf("Error compiling module!\n");
    if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
      try_catch.ReThrow();
    }
    return;
  }
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
  module_map.insert(std::make_pair(module->GetIdentityHash(), 
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
void spin::Builtins(const FunctionCallbackInfo<Value> &args) {
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

void spin::Libraries(const FunctionCallbackInfo<Value> &args) {
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

void spin::SetModuleCallbacks(const FunctionCallbackInfo<Value> &args) {
  // todo: is putting this in context correct?
  Local<Context> context = args.GetIsolate()->GetCurrentContext();
  context->SetEmbedderData(1, args[0].As<Function>()); // async resolver
  context->SetEmbedderData(2, args[1].As<Function>()); // sync resolver
}

// fast api calls
void spin::GetErrno(const FunctionCallbackInfo<Value> &args) {
  args.GetReturnValue().Set(errno);
}

int spin::fastGetErrno (void* p) {
  return errno;
}

void spin::SetErrno(const FunctionCallbackInfo<Value> &args) {
  errno = Local<Integer>::Cast(args[0])->Value();
}

void spin::fastSetErrno (void* p, int32_t e) {
  errno = e;
}

uint64_t spin::hrtime() {
  if (clock_gettime(clock_id, &t)) return 0;
  return (t.tv_sec * (uint64_t) 1e9) + t.tv_nsec;
}

void spin::HRTime(const FunctionCallbackInfo<Value> &args) {
  ((uint64_t*)args[0].As<Uint32Array>()->Buffer()->Data())[0] = hrtime();
}

void spin::fastHRTime (void* p, struct FastApiTypedArray* const p_ret) {
  ((uint64_t*)p_ret->data)[0] = hrtime();
}

void spin::GetAddress(const FunctionCallbackInfo<Value> &args) {
  Local<TypedArray> ta = args[0].As<TypedArray>();
  uint8_t* ptr = (uint8_t*)ta->Buffer()->Data() + ta->ByteOffset();
  ((uint64_t*)args[1].As<Uint32Array>()->Buffer()->Data())[0] = (uint64_t)ptr;
}

void spin::fastGetAddress(void* p, struct FastApiTypedArray* const p_buf, 
  struct FastApiTypedArray* const p_ret) {
  ((uint64_t*)p_ret->data)[0] = (uint64_t)p_buf->data;
}

void spin::Utf8Length(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  args.GetReturnValue().Set(args[0].As<String>()->Utf8Length(isolate));
}

int32_t spin::fastUtf8Length (void* p, struct FastOneByteString* const p_str) {
  return p_str->length;
}

void spin::GetMeta(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  Local<Object> meta = args[1].As<Object>();
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
  meta->Set(context, String::NewFromUtf8Literal(isolate, "isExternal", NewStringType::kInternalized), v8::Boolean::New(isolate, isExternal)).Check();
  meta->Set(context, String::NewFromUtf8Literal(isolate, "isDetachable", NewStringType::kInternalized), v8::Boolean::New(isolate, isDetachable)).Check();
  meta->Set(context, String::NewFromUtf8Literal(isolate, "isShared", NewStringType::kInternalized), v8::Boolean::New(isolate, isShared)).Check();
}

void spin::ReadMemory(const FunctionCallbackInfo<Value> &args) {
  Local<Uint8Array> u8 = args[0].As<Uint8Array>();
  uint8_t* dest = (uint8_t*)u8->Buffer()->Data() + u8->ByteOffset();
  void* start = reinterpret_cast<void*>(
    (uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t size = Local<Integer>::Cast(args[2])->Value();
  memcpy(dest, start, size);
}

void spin::fastReadMemory (void* p, struct FastApiTypedArray* const p_buf, 
  void* start, uint32_t size) {
  memcpy(p_buf->data, start, size);
}

// todo: version that wraps memory in place with an arraybuffer
void spin::ReadMemoryAtOffset(const FunctionCallbackInfo<Value> &args) {
  Local<Uint8Array> u8 = args[0].As<Uint8Array>();
  uint32_t off = Local<Integer>::Cast(args[3])->Value();
  uint8_t* dest = (uint8_t*)u8->Buffer()->Data() + off;
  void* start = reinterpret_cast<void*>(
    (uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t size = Local<Integer>::Cast(args[2])->Value();
  memcpy(dest, start, size);
}

void spin::fastReadMemoryAtOffset (void* p, struct FastApiTypedArray* const p_buf, 
  void* start, uint32_t size, uint32_t off) {
  uint8_t* ptr = (uint8_t*)p_buf->data + off;
  memcpy(ptr, start, size);
}

void spin::WrapMemory(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
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
      start, size, spin::FreeMemory, nullptr);
  Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
  args.GetReturnValue().Set(ab);
}

void spin::UnWrapMemory(const FunctionCallbackInfo<Value> &args) {
  Local<ArrayBuffer> ab = args[0].As<ArrayBuffer>();
  ab->Detach();
}

void spin::SetFlags(const FunctionCallbackInfo<Value> &args) {
  String::Utf8Value flags(args.GetIsolate(), args[0]);
  //V8::SetFlagsFromString(*flags, static_cast<size_t>(flags.length()));
  V8::SetFlagsFromString(*flags);
}

void spin::Utf8Encode(const FunctionCallbackInfo<Value> &args) {
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

void spin::Utf8Decode(const FunctionCallbackInfo<Value> &args) {
  int size = -1;
  if (args.Length() > 1) {
    size = Local<Integer>::Cast(args[1])->Value();
  }
  char* str = reinterpret_cast<char*>(
    (uint64_t)Local<Integer>::Cast(args[0])->Value());
  args.GetReturnValue().Set(String::NewFromUtf8(args.GetIsolate(), 
    str, NewStringType::kNormal, size).ToLocalChecked());
}

void spin::Utf8EncodeInto(const FunctionCallbackInfo<Value> &args) {
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

int32_t spin::fastUtf8EncodeInto (void* p, struct FastOneByteString* 
  const p_str, struct FastApiTypedArray* const p_buf) {
  memcpy(p_buf->data, p_str->data, p_str->length);
  return p_str->length;
}

void spin::Utf8EncodeIntoAtOffset(const FunctionCallbackInfo<Value> &args) {
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
    String::NO_NULL_TERMINATION | String::REPLACE_INVALID_UTF8);
  args.GetReturnValue().Set(Integer::New(isolate, written));
}

int32_t spin::fastUtf8EncodeIntoAtOffset (void* p, struct FastOneByteString* 
  const p_str, struct FastApiTypedArray* const p_buf, uint32_t off) {
  uint8_t* dest = (uint8_t*)p_buf->data + off;
  memcpy(dest, p_str->data, p_str->length);
  return p_str->length;
}

void spin::Print(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  if (args[0].IsEmpty()) return;
  String::Utf8Value str(isolate, args[0]);
  fprintf(stdout, "%s", *str);
}

void spin::RunScript(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  TryCatch try_catch(isolate);
  Local<String> source = args[0].As<String>();
  Local<String> path = args[1].As<String>();
  Local<v8::PrimitiveArray> opts =
      v8::PrimitiveArray::New(isolate, 1);
  opts->Set(isolate, 0, v8::Number::New(isolate, 1));
  ScriptOrigin baseorigin(isolate, path, // resource name
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

void spin::Init(Isolate* isolate, Local<ObjectTemplate> target) {
  Local<ObjectTemplate> version = ObjectTemplate::New(isolate);
  SET_VALUE(isolate, version, GLOBALOBJ, String::NewFromUtf8Literal(isolate, 
    VERSION));
  SET_VALUE(isolate, version, "v8", String::NewFromUtf8(isolate, 
    V8::GetVersion()).ToLocalChecked());
  SET_MODULE(isolate, target, "version", version);
  SET_METHOD(isolate, target, "nextTick", NextTick);
  SET_METHOD(isolate, target, "print", Print);
  SET_METHOD(isolate, target, "registerCallback", RegisterCallback);
  SET_METHOD(isolate, target, "runMicroTasks", RunMicroTasks);
  SET_METHOD(isolate, target, "builtin", Builtin);
  SET_METHOD(isolate, target, "library", Library);
  SET_METHOD(isolate, target, "builtins", Builtins);
  SET_METHOD(isolate, target, "libraries", Libraries);
  SET_METHOD(isolate, target, "setModuleCallbacks", SetModuleCallbacks);
  SET_METHOD(isolate, target, "loadModule", LoadModule);
  SET_METHOD(isolate, target, "evaluateModule", EvaluateModule);
  SET_METHOD(isolate, target, "utf8Decode", Utf8Decode);
  SET_METHOD(isolate, target, "utf8Encode", Utf8Encode);
  SET_METHOD(isolate, target, "wrapMemory", WrapMemory);
  SET_METHOD(isolate, target, "unwrapMemory", UnWrapMemory);
  SET_METHOD(isolate, target, "setFlags", SetFlags);
  SET_METHOD(isolate, target, "getMeta", GetMeta);
  SET_METHOD(isolate, target, "runScript", RunScript);
  SET_FAST_PROP(isolate, target, "errno", &pFerrnoget, GetErrno, &pFerrnoset, 
    SetErrno);
  SET_FAST_METHOD(isolate, target, "hrtime", &pFhrtime, HRTime);
  SET_FAST_METHOD(isolate, target, "getAddress", &pFgetaddress, GetAddress);
  SET_FAST_METHOD(isolate, target, "utf8Length", &pFutf8length, Utf8Length);
  SET_FAST_METHOD(isolate, target, "utf8EncodeInto", &pFutf8encodeinto, 
    Utf8EncodeInto);
  SET_FAST_METHOD(isolate, target, "utf8EncodeIntoAtOffset", &pFutf8encodeintoatoffset, 
    Utf8EncodeIntoAtOffset);
  SET_FAST_METHOD(isolate, target, "readMemory", &pFreadmemory, ReadMemory);
  SET_FAST_METHOD(isolate, target, "readMemoryAtOffset", &pFreadmemoryatoffset, ReadMemoryAtOffset);
}

// C/FFI api for managing isolates
int spin_create_isolate (int argc, char** argv, 
  const char* main, unsigned int main_len,
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname,
  int cleanup, int onexit, void* startup_data) {
  const v8::StartupData* data = (const v8::StartupData*) startup_data;
  return spin::CreateIsolate(argc, argv, main, main_len, js, js_len, 
  buf, buflen, fd, start, globalobj, scriptname, cleanup, onexit, data);
}

int spin_context_size () {
  return sizeof(struct isolate_context);
}

void spin_create_isolate_context (int argc, char** argv, 
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

// todo: spin_destroy_isolate_context
void spin_start_isolate (void* ptr) {
  struct isolate_context* ctx = (struct isolate_context*)ptr;
  ctx->rc = spin_create_isolate(ctx->argc, ctx->argv, ctx->main, ctx->main_len,
    ctx->js, ctx->js_len, ctx->buf, ctx->buflen, ctx->fd, ctx->start,
    ctx->globalobj, ctx->scriptname, ctx->cleanup, ctx->onexit, 
    ctx->startup_data);
}

void spin_destroy_isolate_context (struct isolate_context* ctx) {
  free(ctx);
}

// generic callback used to trampoline ffi callbacks back into JS
void spin_callback (exec_info* info) {
  Isolate* isolate = info->isolate;
  HandleScope scope(isolate);
  info->js_fn.Get(isolate)->Call(isolate->GetCurrentContext(), 
    v8::Null(isolate), 0, 0).ToLocalChecked();
}
