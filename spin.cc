#include "spin.h"
#include "src/common/globals.h"

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

std::map<std::string, spin::builtin*> builtins;
std::map<std::string, spin::register_plugin> modules;
std::map<int, Global<Module>> module_map;

clock_t clock_id = CLOCK_MONOTONIC;
struct timespec t;

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

void cleanupIsolate (Isolate* isolate) {
  isolate->ContextDisposedNotification();
  isolate->LowMemoryNotification();
  isolate->ClearKeptObjects();
  bool stop = false;
  while(!stop) {
    stop = isolate->IdleNotificationDeadline(1);  
  }
  isolate->Dispose();
}

CTypeInfo* CTypeFromV8 (uint8_t v8Type) {
  if (v8Type == spin::FastTypes::boolean) 
    return new CTypeInfo(CTypeInfo::Type::kBool);
  if (v8Type == spin::FastTypes::i8) 
    return new CTypeInfo(CTypeInfo::Type::kInt32);
  if (v8Type == spin::FastTypes::i16) 
    return new CTypeInfo(CTypeInfo::Type::kInt32);
  if (v8Type == spin::FastTypes::i32) 
    return new CTypeInfo(CTypeInfo::Type::kInt32);
  if (v8Type == spin::FastTypes::u8) 
    return new CTypeInfo(CTypeInfo::Type::kUint32);
  if (v8Type == spin::FastTypes::u16) 
    return new CTypeInfo(CTypeInfo::Type::kUint32);
  if (v8Type == spin::FastTypes::u32) 
    return new CTypeInfo(CTypeInfo::Type::kUint32);
  if (v8Type == spin::FastTypes::f32) 
    return new CTypeInfo(CTypeInfo::Type::kFloat32);
  if (v8Type == spin::FastTypes::f64) 
    return new CTypeInfo(CTypeInfo::Type::kFloat64);
  if (v8Type == spin::FastTypes::i64) 
    return new CTypeInfo(CTypeInfo::Type::kInt64);
  if (v8Type == spin::FastTypes::u64) 
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == spin::FastTypes::iSize) 
    return new CTypeInfo(CTypeInfo::Type::kInt64);
  if (v8Type == spin::FastTypes::uSize) 
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == spin::FastTypes::pointer) 
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == spin::FastTypes::function) 
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == spin::FastTypes::string) 
    return new CTypeInfo(CTypeInfo::Type::kSeqOneByteString);
  if (v8Type == spin::FastTypes::buffer) {
    return new CTypeInfo(CTypeInfo::Type::kUint8, 
      CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  }
  if (v8Type == spin::FastTypes::u32array) {
    return new CTypeInfo(CTypeInfo::Type::kUint32, 
      CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  }
  return new CTypeInfo(CTypeInfo::Type::kVoid);  
}

ffi_type* FFITypeFromV8 (uint8_t v8Type) {
  if (v8Type == spin::FastTypes::boolean) 
    return &ffi_type_uint8;
  if (v8Type == spin::FastTypes::i8) 
    return &ffi_type_sint8;
  if (v8Type == spin::FastTypes::i16) 
    return &ffi_type_sint16;
  if (v8Type == spin::FastTypes::i32) 
    return &ffi_type_sint32;
  if (v8Type == spin::FastTypes::u8) 
    return &ffi_type_uint8;
  if (v8Type == spin::FastTypes::u16) 
    return &ffi_type_uint16;
  if (v8Type == spin::FastTypes::u32) 
    return &ffi_type_uint32;
  if (v8Type == spin::FastTypes::f32) 
    return &ffi_type_float;
  if (v8Type == spin::FastTypes::f64) 
    return &ffi_type_double;
  if (v8Type == spin::FastTypes::i64) 
    return &ffi_type_sint64;
  if (v8Type == spin::FastTypes::u64) 
    return &ffi_type_uint64;
  if (v8Type == spin::FastTypes::iSize) 
    return &ffi_type_sint64;
  if (v8Type == spin::FastTypes::uSize) 
    return &ffi_type_uint64;
  if (v8Type == spin::FastTypes::pointer) 
    return &ffi_type_pointer;
  if (v8Type == spin::FastTypes::function) 
    return &ffi_type_pointer;
  if (v8Type == spin::FastTypes::string) 
    return &ffi_type_pointer;
  if (v8Type == spin::FastTypes::buffer)
    return &ffi_type_pointer;
  if (v8Type == spin::FastTypes::u32array)
    return &ffi_type_pointer;
  return &ffi_type_void;  
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
    SideEffectType::kHasSideEffect,
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
  int scriptId = result.ToLocalChecked()->Uint32Value(context).ToChecked();
  Local<Module> module = module_map[scriptId].Get(context->GetIsolate());
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

int spin::CreateIsolate(int argc, char** argv, 
  const char* main_src, unsigned int main_len, 
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname, int cleanup,
  int onexit, const v8::StartupData* startup_data) {
  Isolate::CreateParams create_params;
  int statusCode = 0;
  create_params.array_buffer_allocator = 
    ArrayBuffer::Allocator::NewDefaultAllocator();
  create_params.embedder_wrapper_type_index = 0;
  create_params.embedder_wrapper_object_index = 1;
  Isolate *isolate = Isolate::New(create_params);
  {
    Isolate::Scope isolate_scope(isolate);
    HandleScope handle_scope(isolate);
    isolate->SetCaptureStackTraceForUncaughtExceptions(true, 1000, 
      StackTrace::kDetailed);
    isolate->AddNearHeapLimitCallback(spin::nearHeapLimitCallback, 0);
    isolate->SetFatalErrorHandler(fatalErrorcallback);
    isolate->SetOOMErrorHandler(OOMErrorcallback);
    Local<ObjectTemplate> global = ObjectTemplate::New(isolate);
    Local<ObjectTemplate> runtime = ObjectTemplate::New(isolate);
    spin::Init(isolate, runtime);
    global->Set(String::NewFromUtf8(isolate, globalobj, 
      NewStringType::kInternalized, strnlen(globalobj, 256)).ToLocalChecked(), 
      runtime);
    Local<Context> context = Context::New(isolate, NULL, global);
    Context::Scope context_scope(context);
    isolate->SetPromiseRejectCallback(PromiseRejectCallback);
    isolate->SetHostImportModuleDynamicallyCallback(OnDynamicImport);
    Local<Array> arguments = Array::New(isolate);
    for (int i = 0; i < argc; i++) {
      arguments->Set(context, i, String::NewFromUtf8(isolate, argv[i], 
        NewStringType::kNormal, strlen(argv[i])).ToLocalChecked()).Check();
    }
    Local<Object> globalInstance = context->Global();
    globalInstance->Set(context, String::NewFromUtf8Literal(isolate, 
      "global", 
      NewStringType::kNormal), globalInstance).Check();
    Local<Value> obj = globalInstance->Get(context, 
      String::NewFromUtf8(isolate, globalobj, NewStringType::kInternalized, 
        strnlen(globalobj, 256)).ToLocalChecked()).ToLocalChecked();
    Local<Object> runtimeInstance = Local<Object>::Cast(obj);
    if (buf != NULL) {
      std::unique_ptr<BackingStore> backing = 
        SharedArrayBuffer::NewBackingStore(buf, buflen, 
        [](void*, size_t, void*){}, nullptr);
      Local<SharedArrayBuffer> ab = SharedArrayBuffer::New(isolate, 
        std::move(backing));
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, 
        "buffer", NewStringType::kNormal), ab).Check();
    }
    if (start > 0) {
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "start", 
        NewStringType::kNormal), 
        Number::New(isolate, start)).Check();
    }
    if (fd != 0) {
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "fd", 
        NewStringType::kNormal), 
        Integer::New(isolate, fd)).Check();
    }
    runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, "args", 
      NewStringType::kNormal), arguments).Check();
    if (js_len > 0) {
      runtimeInstance->Set(context, String::NewFromUtf8Literal(isolate, 
        "workerSource", NewStringType::kNormal), 
        String::NewFromUtf8(isolate, js, NewStringType::kNormal, 
        js_len).ToLocalChecked()).Check();
    }
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
}

void spin::NextTick(const FunctionCallbackInfo<Value>& args) {
  args.GetIsolate()->EnqueueMicrotask(args[0].As<Function>());
}

void spin::Utf8Decode(const FunctionCallbackInfo<Value> &args) {
  int size = Local<Integer>::Cast(args[1])->Value();
  char* str = reinterpret_cast<char*>((uint64_t)Local<Integer>::Cast(args[0])->Value());
  args.GetReturnValue().Set(String::NewFromUtf8(args.GetIsolate(), 
    str, NewStringType::kNormal, size).ToLocalChecked());
}

void spin::EvaluateModule(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  int scriptId = Local<Integer>::Cast(args[0])->Value();
  Local<Module> module = module_map[scriptId].Get(isolate);
  Maybe<bool> result = module->InstantiateModule(context, 
    spin::OnModuleInstantiate);
  if (result.IsNothing()) {
    printf("\nCan't instantiate module.\n");
    exit(EXIT_FAILURE);
  }
  Local<Value> retValue;
  if (!module->Evaluate(context).ToLocal(&retValue)) {
    printf("Error evaluating module!\n");
    exit(EXIT_FAILURE);
  }
  args.GetReturnValue().Set(module->GetModuleNamespace().As<Promise>());
}

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
    true, // is shared cross-origin
    -1,  // script id
    Local<Value>(), // source map url
    false, // is opaque
    false, // is wasm
    true, // is module
    opts);
  ScriptCompiler::Source base(source, baseorigin);
  Local<Module> module;
  String::Utf8Value path2(isolate, args[1]);
  bool ok = ScriptCompiler::CompileModule(isolate, &base).ToLocal(&module);
  if (!ok) {
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
  int scriptId = module->ScriptId();
  module_map.insert(std::make_pair(scriptId, 
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
    .ToLocalChecked(), Integer::New(isolate, scriptId)).Check();
  args.GetReturnValue().Set(data);
  return;
}

inline uint8_t needsunwrap (spin::FastTypes t) {
  if (t == spin::FastTypes::buffer) return 1;
  if (t == spin::FastTypes::u32array) return 1;
  if (t == spin::FastTypes::pointer) return 1;
  if (t == spin::FastTypes::u64) return 1;
  if (t == spin::FastTypes::i64) return 1;
  return 0;
}

void SlowCallback(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  spin::foreignFunction* ffn = (spin::foreignFunction*)args.Data()
    .As<Object>()->GetAlignedPointerFromInternalField(1);
  ffi_cif* cif = ffn->cif;
  ffi_arg result;
  void** values = ffn->values;
  // TODO: optimize this
  for (int i = 0; i < ffn->nargs; i++) {
    if (ffn->params[i] == spin::FastTypes::i32) {
      int32_t v = (int32_t)Local<Integer>::Cast(args[i])->Value();
      values[i] = &v;
      continue;
    }
    if (ffn->params[i] == spin::FastTypes::u32) {
      uint32_t v = (uint32_t)Local<Integer>::Cast(args[i])->Value();
      values[i] = &v;
      continue;
    }
    if (ffn->params[i] == spin::FastTypes::u64) {
      uint64_t v = (uint64_t)Local<Integer>::Cast(args[i])->Value();
      values[i] = &v;
      continue;
    }
    if (ffn->params[i] == spin::FastTypes::pointer) {
      uint64_t v = (uint64_t)Local<Integer>::Cast(args[i])->Value();
      values[i] = &v;
      continue;
    }
    if (ffn->params[i] == spin::FastTypes::buffer) {
      uint64_t v = (uint64_t)args[i].As<Uint8Array>()->Buffer()->Data();
      values[i] = &v;
      continue;
    }
    if (ffn->params[i] == spin::FastTypes::u32array) {
      uint64_t v = (uint64_t)args[i].As<Uint32Array>()->Buffer()->Data();
      values[i] = &v;
      continue;
    }
    if (ffn->params[i] == spin::FastTypes::string) {
      String::Utf8Value arg0(isolate, args[i]);
      char* v = *arg0;
      values[i] = &v;
      continue;
    }
  }
  ffi_call(cif, FFI_FN(ffn->ffi), &result, values);
  if (args.Length() > ffn->nargs) {
    uint64_t* res = (uint64_t*)args[ffn->nargs].As<Uint32Array>()->Buffer()->Data();
    *res = (uint64_t)result;
    return;
  }
  if (ffn->rc == spin::FastTypes::i32) {
    args.GetReturnValue().Set(Integer::New(isolate, (int32_t)result));
    return;
  }
  if (ffn->rc == spin::FastTypes::u32) {
    args.GetReturnValue().Set(Integer::New(isolate, (uint32_t)result));
    return;
  }
}

void spin::BindFastApi(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  void* fn = reinterpret_cast<void*>(Local<Integer>::Cast(args[0])->Value());
  void* wrapped = reinterpret_cast<void*>(Local<Integer>::Cast(args[1])->Value());
  int rtype = Local<Integer>::Cast(args[2])->Value();
  Local<Array> params = args[3].As<Array>();
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
  ffi_cif* cif = (ffi_cif*)calloc(1, sizeof(ffi_cif));
  spin::foreignFunction* ffn = new spin::foreignFunction();
  ffn->fast = wrapped;
  ffn->ffi = fn;
  ffn->cif = cif;
  data->SetAlignedPointerInInternalField(1, ffn);
  int len = params->Length();
  ffi_type* ffirc = FFITypeFromV8(rtype);
  CTypeInfo* rc;
  if (needsunwrap((FastTypes)rtype)) {
    rc = CTypeFromV8(FastTypes::empty);
  } else {
    rc = CTypeFromV8((FastTypes)rtype);
  }
  ffn->rc = (FastTypes)rtype;
  ffi_type** ffiargs = (ffi_type**)calloc(len, sizeof(ffi_type*));
  ffn->params = (FastTypes*)calloc(len, sizeof(FastTypes));
  ffn->nargs = len;
  ffn->values = (void**)calloc(ffn->nargs, sizeof(void*));
  int fastlen = len + 1 + needsunwrap((FastTypes)rtype);
  CTypeInfo* cargs = (CTypeInfo*)calloc(fastlen, sizeof(CTypeInfo));
  cargs[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  for (int i = 0; i < len; i++) {
    uint8_t ptype = Local<Integer>::Cast(
      params->Get(context, i).ToLocalChecked())->Value();
    cargs[i + 1] = *CTypeFromV8(ptype);
    ffiargs[i] = FFITypeFromV8(ptype);
    ffn->params[i] = (FastTypes)ptype;
  }
  if (fastlen - 1 > len) {
    cargs[fastlen - 1] = *CTypeFromV8(FastTypes::u32array);
  }
  ffi_status status = ffi_prep_cif(cif, FFI_DEFAULT_ABI, len, ffirc, ffiargs);
  if (status != FFI_OK) {
    // TODO: fix this api
    return;
  }
  CFunctionInfo* info = new CFunctionInfo(*rc, fastlen, cargs);
  CFunction* fastCFunc = new CFunction(wrapped, info);
  ffn->cfunc = fastCFunc;
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(
    isolate,
    SlowCallback,
    data,
    Local<Signature>(),
    0,
    ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect,
    fastCFunc
  );
  // TODO: figure out how to handle side-effect flag:
  // https://github.com/nodejs/node/pull/46619
  Local<Function> fun = 
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
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

void spin::Modules(const FunctionCallbackInfo<Value> &args) {
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
  Local<ArrayBuffer> ab = args[0].As<Uint32Array>()->Buffer();
  ((uint64_t*)ab->Data())[0] = hrtime();
}

void spin::fastHRTime (void* p, struct FastApiTypedArray* const p_ret) {
  ((uint64_t*)p_ret->data)[0] = hrtime();
}

void spin::GetAddress(const FunctionCallbackInfo<Value> &args) {
  ((uint64_t*)args[1].As<Uint32Array>()->Buffer()->Data())[0] = 
    (uint64_t)args[0].As<Uint8Array>()->Buffer()->Data();
}

void spin::fastGetAddress(void* p, struct FastApiTypedArray* const p_buf, 
  struct FastApiTypedArray* const p_ret) {
  ((uint64_t*)p_ret->data)[0] = (uint64_t)p_buf->data;
}

void spin::Utf8Length(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  args.GetReturnValue().Set(Integer::New(isolate, 
    args[0].As<String>()->Utf8Length(isolate)));
}

int32_t spin::fastUtf8Length (void* p, struct FastOneByteString* const p_str) {
  return p_str->length;
}

void spin::ReadMemory(const FunctionCallbackInfo<Value> &args) {
  uint8_t* dest = static_cast<uint8_t*>(args[0].As<Uint8Array>()->Buffer()->Data());
  void* start = reinterpret_cast<void*>((uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t size = Local<Integer>::Cast(args[2])->Value();
  memcpy(dest, start, size);
}

void spin::fastReadMemory (void* p, struct FastApiTypedArray* const p_buf, void* start, uint32_t size) {
  memcpy(p_buf->data, start, size);
}

void spin::Utf8EncodeInto(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  if (str->IsOneByte()) {
    int size = str->Length();
    uint8_t* dest = static_cast<uint8_t*>(args[1].As<Uint8Array>()->Buffer()->Data());
    int written = str->WriteOneByte(isolate, dest, 0, size, String::NO_NULL_TERMINATION);
    args.GetReturnValue().Set(Integer::New(isolate, written));
    return;
  }
  int written = 0;
  int size = str->Utf8Length(isolate);
  char* dest = static_cast<char*>(args[1].As<Uint8Array>()->Buffer()->Data());
  str->WriteUtf8(isolate, dest, size, &written, 
    String::NO_NULL_TERMINATION | String::REPLACE_INVALID_UTF8);
  args.GetReturnValue().Set(Integer::New(isolate, written));
}

int32_t spin::fastUtf8EncodeInto (void* p, struct FastOneByteString* const p_str, struct FastApiTypedArray* const p_buf) {
  memcpy(p_buf->data, p_str->data, p_str->length);
  return p_str->length;
}

void spin::Init(Isolate* isolate, Local<ObjectTemplate> target) {
  CTypeInfo* cargserrnoset = (CTypeInfo*)calloc(2, 
    sizeof(CTypeInfo));
  cargserrnoset[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  cargserrnoset[1] = CTypeInfo(CTypeInfo::Type::kInt32);
  CTypeInfo* rcerrnoset = new CTypeInfo(CTypeInfo::Type::kVoid);
  CFunctionInfo* infoerrnoset = new CFunctionInfo(*rcerrnoset, 2, 
    cargserrnoset);
  CFunction* pFerrnoset = new CFunction((const void*)&fastSetErrno, 
    infoerrnoset);

  CTypeInfo* cargserrnoget = (CTypeInfo*)calloc(1, 
    sizeof(CTypeInfo));
  cargserrnoget[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  CTypeInfo* rcerrnoget = new CTypeInfo(CTypeInfo::Type::kInt32);
  CFunctionInfo* infoerrnoget = new CFunctionInfo(*rcerrnoget, 1, 
    cargserrnoget);
  CFunction* pFerrnoget = new CFunction((const void*)&fastGetErrno, 
    infoerrnoget);

  CTypeInfo* cargshrtime = (CTypeInfo*)calloc(2, sizeof(CTypeInfo));
  cargshrtime[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  cargshrtime[1] = CTypeInfo(CTypeInfo::Type::kUint32, 
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  CTypeInfo* rchrtime = new CTypeInfo(CTypeInfo::Type::kVoid);
  CFunctionInfo* infohrtime = new CFunctionInfo(*rchrtime, 2, 
    cargshrtime);
  CFunction* pFhrtime = new CFunction((const void*)&fastHRTime, 
    infohrtime);

  CTypeInfo* cargsgetaddress = (CTypeInfo*)calloc(3, 
    sizeof(CTypeInfo));
  cargsgetaddress[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  cargsgetaddress[1] = CTypeInfo(CTypeInfo::Type::kUint8, 
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  cargsgetaddress[2] = CTypeInfo(CTypeInfo::Type::kUint32, 
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  CTypeInfo* rcgetaddress = new CTypeInfo(CTypeInfo::Type::kVoid);
  CFunctionInfo* infogetaddress = new CFunctionInfo(*rcgetaddress, 3, 
    cargsgetaddress);
  CFunction* pFgetaddress = new CFunction((const void*)&fastGetAddress, 
    infogetaddress);

  CTypeInfo* cargsutf8length = (CTypeInfo*)calloc(2, 
    sizeof(CTypeInfo));
  cargsutf8length[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  cargsutf8length[1] = CTypeInfo(CTypeInfo::Type::kSeqOneByteString);
  CTypeInfo* rcutf8length = new CTypeInfo(CTypeInfo::Type::kInt32);
  CFunctionInfo* infoutf8length = new CFunctionInfo(*rcutf8length, 2, 
    cargsutf8length);
  CFunction* pFutf8length = new CFunction((const void*)&fastUtf8Length, 
    infoutf8length);

  CTypeInfo* cargsutf8encodeinto = (CTypeInfo*)calloc(3, 
    sizeof(CTypeInfo));
  cargsutf8encodeinto[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  cargsutf8encodeinto[1] = CTypeInfo(CTypeInfo::Type::kSeqOneByteString);
  cargsutf8encodeinto[2] = CTypeInfo(CTypeInfo::Type::kUint8, 
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  CTypeInfo* rcutf8encodeinto = new CTypeInfo(CTypeInfo::Type::kInt32);
  CFunctionInfo* infoutf8encodeinto = new CFunctionInfo(*rcutf8encodeinto, 3, 
    cargsutf8encodeinto);
  CFunction* pFutf8encodeinto = new CFunction((const void*)&fastUtf8EncodeInto, 
    infoutf8encodeinto);

  CTypeInfo* cargsreadmemory = (CTypeInfo*)calloc(4, 
    sizeof(CTypeInfo));
  cargsreadmemory[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  cargsreadmemory[1] = CTypeInfo(CTypeInfo::Type::kUint8, 
    CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  cargsreadmemory[2] = CTypeInfo(CTypeInfo::Type::kUint64);
  cargsreadmemory[3] = CTypeInfo(CTypeInfo::Type::kUint32);
  CTypeInfo* rcreadmemory = new CTypeInfo(CTypeInfo::Type::kVoid);
  CFunctionInfo* inforeadmemory = new CFunctionInfo(*rcreadmemory, 4, 
    cargsreadmemory);
  CFunction* pFreadmemory = new CFunction((const void*)&fastReadMemory, 
    inforeadmemory);

  Local<ObjectTemplate> version = ObjectTemplate::New(isolate);
  SET_VALUE(isolate, version, GLOBALOBJ, String::NewFromUtf8Literal(isolate, 
    VERSION));
  SET_VALUE(isolate, version, "v8", String::NewFromUtf8(isolate, 
    V8::GetVersion()).ToLocalChecked());
  SET_MODULE(isolate, target, "version", version);

  SET_METHOD(isolate, target, "bindFastApi", BindFastApi);
  SET_METHOD(isolate, target, "nextTick", NextTick);
  SET_METHOD(isolate, target, "runMicroTasks", RunMicroTasks);
  SET_METHOD(isolate, target, "builtin", Builtin);
  SET_METHOD(isolate, target, "library", Library);
  SET_METHOD(isolate, target, "builtins", Builtins);
  SET_METHOD(isolate, target, "modules", Modules);
  SET_METHOD(isolate, target, "setModuleCallbacks", SetModuleCallbacks);
  SET_METHOD(isolate, target, "loadModule", LoadModule);
  SET_METHOD(isolate, target, "evaluateModule", EvaluateModule);
  SET_METHOD(isolate, target, "utf8Decode", Utf8Decode);

  SET_FAST_METHOD(isolate, target, "hrtime", pFhrtime, HRTime);
  SET_FAST_METHOD(isolate, target, "utf8Length", pFutf8length, Utf8Length);
  SET_FAST_METHOD(isolate, target, "utf8EncodeInto", pFutf8encodeinto, Utf8EncodeInto);
  SET_FAST_METHOD(isolate, target, "getAddress", pFgetaddress, GetAddress);
  SET_FAST_METHOD(isolate, target, "readMemory", pFreadmemory, ReadMemory);

  SET_FAST_PROP(isolate, target, "errno", pFerrnoget, GetErrno, pFerrnoset, 
    SetErrno);
}
