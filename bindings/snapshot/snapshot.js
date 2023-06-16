const api = {
  create_snapshot: {
    name: 'create_snapshot',
    declare_only: true,
    nofast: true
  }
}

const preamble = `
bool RunExtraCode(v8::Isolate* isolate, v8::Local<v8::Context> context,
                  const char* utf8_source, const char* name) {
  v8::Context::Scope context_scope(context);
  v8::TryCatch try_catch(isolate);
  v8::Local<v8::String> source_string;
  if (!v8::String::NewFromUtf8(isolate, utf8_source).ToLocal(&source_string)) {
    return false;
  }
  v8::Local<v8::String> resource_name =
      v8::String::NewFromUtf8(isolate, name).ToLocalChecked();
  v8::ScriptOrigin origin(isolate, resource_name);
  v8::ScriptCompiler::Source source(source_string, origin);
  v8::Local<v8::Script> script;
  if (!v8::ScriptCompiler::Compile(context, &source).ToLocal(&script))
    return false;
  if (script->Run(context).IsEmpty()) return false;
  if (try_catch.HasCaught() && !try_catch.HasTerminated()) {
    spin::PrintStackTrace(isolate, try_catch);
    return false;
  }
  return true;
}

void create_snapshotSlow (const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = v8::Isolate::Allocate();
  v8::HandleScope scope(isolate);
  const char* embedded_source = reinterpret_cast<const char*>(
    (uint64_t)Local<Integer>::Cast(args[0])->Value());
  v8::SnapshotCreator snapshot_creator(isolate);
  {
    v8::Local<v8::Context> context = v8::Context::New(isolate);
    if (embedded_source != nullptr &&
        !RunExtraCode(isolate, context, embedded_source, "<embedded>")) {
      return;
    }
    snapshot_creator.SetDefaultContext(context);
  }
  v8::StartupData sna = snapshot_creator.CreateBlob(v8::SnapshotCreator::FunctionCodeHandling::kClear);
  ((uint64_t*)args[1].As<Uint32Array>()->Buffer()->Data())[0] = (uint64_t)sna.data;
  args.GetReturnValue().Set(Integer::New(isolate, sna.raw_size));
}
`
const name = 'snapshot'

export { name, api, preamble }
