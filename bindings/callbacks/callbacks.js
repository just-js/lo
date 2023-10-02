const api = {
  call_callback: {
    declare_only: true,
    nofast: true
  },
}

const preamble = `
void call_callbackSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Function> fn = args[0].As<Function>();
  uint32_t iter = Local<Integer>::Cast(args[1])->Value();
  HandleScope scope(isolate);
  Local<Context> context = isolate->GetCurrentContext();
  Local<Value> result = Integer::New(isolate, 1);
  Local<Value> argv[1] = { result };
  Local<Value> nul = v8::Null(isolate);
  for (uint32_t i = 0; i < iter; i++) {
    argv[0] = fn->Call(context, nul, 1, argv).ToLocalChecked();
  }
}
`

const name = 'callbacks'

export { name, api, preamble }
