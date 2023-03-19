#include "spin.h"

std::map<std::string, spin::builtin*> spin::builtins;
std::map<std::string, spin::register_plugin> spin::modules;
std::map<int, v8::Global<v8::Module>> spin::module_map;

clock_t clock_id = CLOCK_MONOTONIC;
struct timespec t;

void spin::builtins_add (const char* name, const char* source, 
  unsigned int size) {
  struct builtin* b = new builtin();
  b->size = size;
  b->source = source;
  builtins[name] = b;
}

void spin::FreeMemory(void* buf, size_t length, void* data) {
  free(buf);
}

void cleanupIsolate (v8::Isolate* isolate) {
  isolate->ContextDisposedNotification();
  isolate->LowMemoryNotification();
  isolate->ClearKeptObjects();
  bool stop = false;
  while(!stop) {
    stop = isolate->IdleNotificationDeadline(1);  
  }
  isolate->Dispose();
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
  if (v8Type == spin::FastTypes::empty) 
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
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

void spin::SET_PROP(Isolate *isolate, Local<ObjectTemplate> 
  recv, const char *name, FunctionCallback getter,
  FunctionCallback setter) {
  enum v8::PropertyAttribute attributes =
      static_cast<v8::PropertyAttribute>(v8::PropertyAttribute::None | 
      v8::PropertyAttribute::DontDelete);
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

void spin::SET_FAST_METHOD(Isolate* isolate, v8::Local<v8::ObjectTemplate> 
  exports, const char * name, v8::CFunction* fastCFunc, v8::FunctionCallback slowFunc) {
  v8::Local<v8::FunctionTemplate> funcTemplate = v8::FunctionTemplate::New(
    isolate,
    slowFunc,
    v8::Local<v8::Value>(),
    v8::Local<v8::Signature>(),
    0,
    v8::ConstructorBehavior::kThrow,
    v8::SideEffectType::kHasSideEffect,
    fastCFunc
  );
  exports->Set(
    v8::String::NewFromUtf8(isolate, name).ToLocalChecked(),
    funcTemplate
  );
}

void spin::SET_FAST_PROP(Isolate* isolate, v8::Local<v8::ObjectTemplate> 
  exports, const char * name, v8::CFunction* fastGetter, v8::FunctionCallback slowGetter,
  v8::CFunction* fastSetter, v8::FunctionCallback slowSetter) {
  v8::Local<v8::FunctionTemplate> getter = v8::FunctionTemplate::New(
    isolate,
    slowGetter,
    v8::Local<v8::Value>(),
    v8::Local<v8::Signature>(),
    0,
    v8::ConstructorBehavior::kThrow,
    v8::SideEffectType::kHasNoSideEffect,
    fastGetter
  );
  v8::Local<v8::FunctionTemplate> setter = v8::FunctionTemplate::New(
    isolate,
    slowSetter,
    v8::Local<v8::Value>(),
    v8::Local<v8::Signature>(),
    0,
    v8::ConstructorBehavior::kThrow,
    v8::SideEffectType::kHasNoSideEffect,
    fastSetter
  );
  enum v8::PropertyAttribute attributes =
      static_cast<v8::PropertyAttribute>(v8::PropertyAttribute::None | 
      v8::PropertyAttribute::DontDelete);
  exports->SetAccessorProperty(
    v8::String::NewFromUtf8(isolate, name).ToLocalChecked(),
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
  v8::String::Utf8Value err_message(isolate, message->Get().As<String>());
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
  if (data.GetEvent() == v8::kPromiseRejectAfterResolved ||
      data.GetEvent() == v8::kPromiseResolveAfterResolved) {
    return;
  }
  Local<Promise> promise = data.GetPromise();
  Isolate* isolate = promise->GetIsolate();
  if (data.GetEvent() == v8::kPromiseHandlerAddedAfterReject) {
    return;
  }
  Local<Value> exception = data.GetValue();
  v8::Local<Message> message;
  if (exception->IsObject()) {
    message = v8::Exception::CreateMessage(isolate, exception);
  }
  if (!exception->IsNativeError() &&
      (message.IsEmpty() || message->GetStackTrace().IsEmpty())) {
    exception = v8::Exception::Error(
        v8::String::NewFromUtf8Literal(isolate, "Unhandled Promise."));
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

v8::MaybeLocal<v8::Module> spin::OnModuleInstantiate(Local<v8::Context> context,
  v8::Local<v8::String> specifier,
  v8::Local<v8::FixedArray> import_assertions, 
  v8::Local<v8::Module> referrer) {
  v8::Isolate* isolate = context->GetIsolate();
  v8::String::Utf8Value str(isolate, specifier);
  v8::Local<v8::Function> callback = 
    context->GetEmbedderData(2).As<v8::Function>();
  v8::Local<v8::Value> argv[1] = { specifier };
  v8::MaybeLocal<v8::Value> result = callback->Call(context, 
    context->Global(), 1, argv);
  int scriptId = result.ToLocalChecked()->Uint32Value(context).ToChecked();
  Local<Module> module = spin::module_map[scriptId].Get(context->GetIsolate());
  return module;
}

v8::MaybeLocal<v8::Promise> OnDynamicImport(v8::Local<v8::Context> context,
  v8::Local<v8::Data> host_defined_options, v8::Local<v8::Value> resource_name,
  v8::Local<v8::String> specifier,v8::Local<v8::FixedArray> import_assertions) {
  v8::Local<v8::Promise::Resolver> resolver =
      v8::Promise::Resolver::New(context).ToLocalChecked();
  v8::MaybeLocal<v8::Promise> promise(resolver->GetPromise());
  v8::Local<v8::Function> callback = 
    context->GetEmbedderData(1).As<v8::Function>();
  v8::Local<v8::Value> argv[2] = { specifier, resource_name };
  v8::MaybeLocal<v8::Value> result = callback->Call(context, 
    context->Global(), 2, argv);
  return v8::Local<v8::Promise>::Cast(result.ToLocalChecked());
}

int spin::CreateIsolate(int argc, char** argv, 
  const char* main_src, unsigned int main_len, 
  const char* js, unsigned int js_len, char* buf, int buflen, int fd,
  uint64_t start, const char* globalobj, const char* scriptname, int cleanup,
  int onexit) {
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
    Local<v8::PrimitiveArray> opts =
        v8::PrimitiveArray::New(isolate, spin::HostDefinedOptions::kLength);
    opts->Set(isolate, spin::HostDefinedOptions::kType, 
      v8::Number::New(isolate, spin::ScriptType::kModule));
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
    //fprintf(stderr, "compile3 %s\n", scriptname);
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
  int onexit) {
  return CreateIsolate(argc, argv, main_src, main_len, NULL, 0, NULL, 0, 0, 
    start, globalobj, "main.js", cleanup, onexit);
}

void spin::Print(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  if (args[0].IsEmpty()) return;
  String::Utf8Value str(args.GetIsolate(), args[0]);
  int endline = 1;
  if (args.Length() > 1) {
    endline = static_cast<int>(args[1]->BooleanValue(isolate));
  }
  const char *cstr = *str;
  if (endline == 1) {
    fprintf(stdout, "%s\n", cstr);
  } else {
    fprintf(stdout, "%s", cstr);
  }
}

void spin::Error(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  if (args[0].IsEmpty()) return;
  String::Utf8Value str(args.GetIsolate(), args[0]);
  int endline = 1;
  if (args.Length() > 1) {
    endline = static_cast<int>(args[1]->BooleanValue(isolate));
  }
  const char *cstr = *str;
  if (endline == 1) {
    fprintf(stderr, "%s\n", cstr);
  } else {
    fprintf(stderr, "%s", cstr);
  }
}

void spin::Library(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  Local<ObjectTemplate> exports = ObjectTemplate::New(isolate);
  if (args[0]->IsString()) {
    String::Utf8Value name(isolate, args[0]);
    auto iter = spin::modules.find(*name);
    if (iter == spin::modules.end()) {
      return;
    } else {
      register_plugin _init = (*iter->second);
      auto _register = reinterpret_cast<InitializerCallback>(_init());
      _register(isolate, exports);
    }
  } else {
    uint64_t start64 = (uint64_t)args[0]->IntegerValue(context).ToChecked();
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
  spin::builtin* b = builtins[*name];
  if (b == nullptr) {
    args.GetReturnValue().Set(Null(isolate));
    return;
  }
  if (args.Length() == 1) {
    args.GetReturnValue().Set(String::NewFromUtf8(isolate, b->source, 
      NewStringType::kNormal, b->size).ToLocalChecked());
    return;
  }
  // does it need to be a shared buffer? we don't ever pass it across 
  // isolates.
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

void spin::Utf8Encode(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<String> str = args[0].As<String>();
  if (str->IsOneByte()) {
    int size = str->Length();  
    uint8_t* chunk = (uint8_t*)calloc(1, size);
    str->WriteOneByte(isolate, chunk, 0, size, 
      String::HINT_MANY_WRITES_EXPECTED | String::NO_NULL_TERMINATION);
    std::unique_ptr<BackingStore> backing = ArrayBuffer::NewBackingStore(chunk, 
      size, spin::FreeMemory, nullptr);
    Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
    Local<v8::TypedArray> u8 = v8::Uint8Array::New(ab, 0, size);
    args.GetReturnValue().Set(u8);
    return;
  }
  int size = str->Utf8Length(isolate);
  char* chunk = (char*)calloc(1, size);
  int written = 0;
  str->WriteUtf8(isolate, chunk, size, &written, 
    String::HINT_MANY_WRITES_EXPECTED | String::NO_NULL_TERMINATION |
    String::REPLACE_INVALID_UTF8);
  std::unique_ptr<BackingStore> backing = ArrayBuffer::NewBackingStore(chunk, 
    size, spin::FreeMemory, nullptr);
  Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
  Local<v8::TypedArray> u8 = v8::Uint8Array::New(ab, 0, size);
  args.GetReturnValue().Set(u8);
}

void spin::Utf8Decode(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  char* str = reinterpret_cast<char*>((uint64_t)args[0]->IntegerValue(
    isolate->GetCurrentContext()).ToChecked());
  size_t len = Local<Integer>::Cast(args[1])->Value();
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, 
    str, NewStringType::kNormal, len).ToLocalChecked());
}

void spin::EvaluateModule(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  int scriptId = Local<Integer>::Cast(args[0])->Value();
  Local<Module> module = spin::module_map[scriptId].Get(isolate);
  v8::Maybe<bool> result = module->InstantiateModule(context, 
    spin::OnModuleInstantiate);
  if (result.IsNothing()) {
    printf("\nCan't instantiate module.\n");
    exit(EXIT_FAILURE);
  }
  v8::Local<v8::Value> retValue;
  if (!module->Evaluate(context).ToLocal(&retValue)) {
    printf("Error evaluating module!\n");
    exit(EXIT_FAILURE);
  }
  //Local<Promise> result_promise(retValue.As<Promise>());
  //args.GetReturnValue().Set(result_promise);
  args.GetReturnValue().Set(module->GetModuleNamespace().As<Promise>());
}

void spin::LoadModule(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  TryCatch try_catch(isolate);
  Local<String> source = args[0].As<String>();
  Local<String> path = args[1].As<String>();
  Local<v8::PrimitiveArray> opts =
      v8::PrimitiveArray::New(isolate, spin::HostDefinedOptions::kLength);
  opts->Set(isolate, spin::HostDefinedOptions::kType,
                            v8::Number::New(isolate, spin::ScriptType::kModule));
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
    Local<v8::ModuleRequest> module_request =
        module_requests->Get(context, i).As<v8::ModuleRequest>();
    requests->Set(context, i, module_request->GetSpecifier()).Check();
  }
  int scriptId = module->ScriptId();
  spin::module_map.insert(std::make_pair(scriptId, 
    v8::Global<v8::Module>(isolate, module)));
  data->Set(context, String::NewFromUtf8(isolate, "requests")
    .ToLocalChecked(), requests).Check();
  data->Set(context, String::NewFromUtf8(isolate, "isSourceTextModule")
    .ToLocalChecked(), v8::Boolean::New(isolate, module->IsSourceTextModule()))
    .Check();
  data->Set(context, String::NewFromUtf8(isolate, "status")
    .ToLocalChecked(), v8::Integer::New(isolate, module->GetStatus()))
    .Check();
  data->Set(context, String::NewFromUtf8(isolate, "specifier")
    .ToLocalChecked(), path).Check();
  data->Set(context, String::NewFromUtf8(isolate, "src")
    .ToLocalChecked(), source).Check();
  data->Set(context, String::NewFromUtf8(isolate, "identity")
    .ToLocalChecked(), v8::Integer::New(isolate, module->GetIdentityHash()))
    .Check();
  data->Set(context, String::NewFromUtf8(isolate, "scriptId")
    .ToLocalChecked(), v8::Integer::New(isolate, scriptId)).Check();
  args.GetReturnValue().Set(data);
  return;
}

// this could be a fast call - don't think so
void spin::ReadMemory(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  uint64_t start64 = (uint64_t)args[0]->IntegerValue(context).ToChecked();
  uint64_t end64 = (uint64_t)args[1]->IntegerValue(context).ToChecked();
  const uint64_t size = end64 - start64;
  void* start = reinterpret_cast<void*>(start64);
  int free = 0;
  if (args.Length() > 2) free = Local<Integer>::Cast(args[2])->Value();
  if (free == 0) {
    std::unique_ptr<BackingStore> backing = ArrayBuffer::NewBackingStore(
        start, size, [](void*, size_t, void*){}, nullptr);
    Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
    Local<v8::TypedArray> u8 = v8::Uint8Array::New(ab, 0, size);
    args.GetReturnValue().Set(u8);
    return;
  }
  std::unique_ptr<BackingStore> backing = ArrayBuffer::NewBackingStore(
      start, size, spin::FreeMemory, nullptr);
  Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
  Local<v8::TypedArray> u8 = v8::Uint8Array::New(ab, 0, size);
  args.GetReturnValue().Set(u8);
}

void spin::Utf8Length(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  args.GetReturnValue().Set(Integer::New(isolate, 
    args[0].As<String>()->Utf8Length(isolate)));
}

void SlowCallback(const v8::FunctionCallbackInfo<v8::Value> &args) {
  v8::Isolate* isolate = args.GetIsolate();
  v8::Local<v8::Object> data = args.Data().As<v8::Object>();
  spin::foreignFunction* ffn = 
    (spin::foreignFunction*)data->GetAlignedPointerFromInternalField(1);
  v8::Local<v8::Function> callback = v8::Local<v8::Function>::New(isolate, 
    ffn->callback);
  int argc = args.Length();
  v8::Local<v8::Value>* fargs = new v8::Local<v8::Value> [argc];
  for (int i = 0; i < argc; i++) fargs[i] = args[i];
  v8::Local<v8::Context> context = isolate->GetCurrentContext();
  args.GetReturnValue().Set(callback->Call(context, context->Global(), argc, 
    fargs).ToLocalChecked());
}

void spin::BindFastApi(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
  void* fn = reinterpret_cast<void*>(Local<Integer>::Cast(args[0])->Value());
  int rtype = Local<Integer>::Cast(args[1])->Value();
  Local<Array> params = args[2].As<Array>();
  spin::foreignFunction* ffn = new spin::foreignFunction();
  ffn->callback.Reset(isolate, args[3].As<Function>());
  ffn->fast = fn;
  data->SetAlignedPointerInInternalField(1, ffn);
  int len = params->Length();
  v8::CTypeInfo* rc = CTypeFromV8(rtype);
  v8::CTypeInfo* cargs = (v8::CTypeInfo*)calloc(len + 1, sizeof(v8::CTypeInfo));
  cargs[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  for (int i = 0; i < len; i++) {
    uint8_t ptype = Local<Integer>::Cast(
      params->Get(context, i).ToLocalChecked())->Value();
    cargs[i + 1] = *CTypeFromV8(ptype);
  }
  v8::CFunctionInfo* info = new v8::CFunctionInfo(*rc, len + 1, cargs);
  v8::CFunction* fastCFunc = new v8::CFunction(fn, info);
  ffn->cfunc = fastCFunc;
  v8::Local<v8::FunctionTemplate> funcTemplate = v8::FunctionTemplate::New(
    isolate,
    SlowCallback,
    data,
    v8::Local<v8::Signature>(),
    0,
    v8::ConstructorBehavior::kThrow,
    v8::SideEffectType::kHasNoSideEffect,
    fastCFunc
  );
  v8::Local<v8::Function> fun = 
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}

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
  ((uint64_t*)args[1].As<v8::Uint32Array>()->Buffer()->Data())[0] = 
    (uint64_t)args[0].As<v8::Uint8Array>()->Buffer()->Data();
}

void spin::fastGetAddress(void* p, struct FastApiTypedArray* const p_buf, 
  struct FastApiTypedArray* const p_ret) {
  ((uint64_t*)p_ret->data)[0] = (uint64_t)p_buf->data;
}

// v8 callbacks
size_t spin::nearHeapLimitCallback(void* data, size_t current_heap_limit,
  size_t initial_heap_limit) {
  fprintf(stderr, "nearHeapLimitCallback\n");
  return 0;
}

void fatalErrorcallback (const char* location, const char* message) {
  fprintf(stderr, "fatalErrorcallback\n%s\n%s\n", location, message);
}

void OOMErrorcallback (const char* location, const v8::OOMDetails& details) {
  fprintf(stderr, "OOMErrorcallback\n%s\nis heap oom? %d\n%s\n", location, details.is_heap_oom, details.detail);
}

void spin::Init(Isolate* isolate, Local<ObjectTemplate> target) {
  Local<ObjectTemplate> version = ObjectTemplate::New(isolate);

  isolate->AddNearHeapLimitCallback(spin::nearHeapLimitCallback, 0);
  isolate->SetFatalErrorHandler(fatalErrorcallback);
  isolate->SetOOMErrorHandler(OOMErrorcallback);

  v8::CTypeInfo* cargserrnoset = (v8::CTypeInfo*)calloc(2, 
    sizeof(v8::CTypeInfo));
  cargserrnoset[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargserrnoset[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CTypeInfo* rcerrnoset = new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
  v8::CFunctionInfo* infoerrnoset = new v8::CFunctionInfo(*rcerrnoset, 2, 
    cargserrnoset);
  v8::CFunction* pFerrnoset = new v8::CFunction((const void*)&fastSetErrno, 
    infoerrnoset);
  v8::CTypeInfo* cargserrnoget = (v8::CTypeInfo*)calloc(1, 
    sizeof(v8::CTypeInfo));
  cargserrnoget[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  v8::CTypeInfo* rcerrnoget = new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  v8::CFunctionInfo* infoerrnoget = new v8::CFunctionInfo(*rcerrnoget, 1, 
    cargserrnoget);
  v8::CFunction* pFerrnoget = new v8::CFunction((const void*)&fastGetErrno, 
    infoerrnoget);

  v8::CTypeInfo* cargshrtime = (v8::CTypeInfo*)calloc(2, sizeof(v8::CTypeInfo));
  cargshrtime[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargshrtime[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, 
    v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  v8::CTypeInfo* rchrtime = new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
  v8::CFunctionInfo* infohrtime = new v8::CFunctionInfo(*rchrtime, 2, 
    cargshrtime);
  v8::CFunction* pFhrtime = new v8::CFunction((const void*)&fastHRTime, 
    infohrtime);

  v8::CTypeInfo* cargsgetaddress = (v8::CTypeInfo*)calloc(3, 
    sizeof(v8::CTypeInfo));
  cargsgetaddress[0] = v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value);
  cargsgetaddress[1] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint8, 
    v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  cargsgetaddress[2] = v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, 
    v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  v8::CTypeInfo* rcgetaddress = new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
  v8::CFunctionInfo* infogetaddress = new v8::CFunctionInfo(*rcgetaddress, 3, 
    cargsgetaddress);
  v8::CFunction* pFgetaddress = new v8::CFunction((const void*)&fastGetAddress, 
    infogetaddress);

  SET_VALUE(isolate, version, GLOBALOBJ, String::NewFromUtf8Literal(isolate, 
    VERSION));
  SET_VALUE(isolate, version, "v8", String::NewFromUtf8(isolate, 
    v8::V8::GetVersion()).ToLocalChecked());
  SET_MODULE(isolate, target, "version", version);
  SET_METHOD(isolate, target, "runMicroTasks", RunMicroTasks);
  SET_METHOD(isolate, target, "nextTick", NextTick);
  SET_METHOD(isolate, target, "builtin", Builtin);
  SET_METHOD(isolate, target, "library", Library);
  SET_METHOD(isolate, target, "readMemory", ReadMemory);
  SET_METHOD(isolate, target, "utf8Decode", Utf8Decode);
  SET_METHOD(isolate, target, "utf8Encode", Utf8Encode);
  SET_METHOD(isolate, target, "utf8Length", Utf8Length);
  SET_METHOD(isolate, target, "print", Print);
  SET_METHOD(isolate, target, "error", Error);
  SET_METHOD(isolate, target, "setModuleCallbacks", SetModuleCallbacks);
  SET_METHOD(isolate, target, "loadModule", LoadModule);
  SET_METHOD(isolate, target, "evaluateModule", EvaluateModule);
  SET_METHOD(isolate, target, "bindFastApi", BindFastApi);
  SET_METHOD(isolate, target, "builtins", Builtins);
  SET_METHOD(isolate, target, "modules", Modules);
  SET_FAST_METHOD(isolate, target, "hrtime", pFhrtime, HRTime);
  SET_FAST_METHOD(isolate, target, "getAddress", pFgetaddress, GetAddress);
  SET_FAST_PROP(isolate, target, "errno", pFerrnoget, GetErrno, pFerrnoset, 
    SetErrno);
}
