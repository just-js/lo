const libs = [
  'lib/asm.js',
  'lib/asm/compiler.js',
  'lib/asm/x64.js',
  'lib/bench.js',
  'lib/ffi.js',
  'lib/proc.js',
]

const bindings = [
  'core',
  'ada',
  'boringssl',
  'curl',
  'heap',
  'luajit',
  'md4c',
  'python'
]

const linkerScript = `
.global _binary_lib_ffi_js_start
_binary_lib_ffi_js_start:
        .incbin "lib/ffi.js"
        .global _binary_lib_ffi_js_end
_binary_lib_ffi_js_end:
.global _binary_lib_bench_js_start
_binary_lib_bench_js_start:
        .incbin "lib/bench.js"
        .global _binary_lib_bench_js_end
_binary_lib_bench_js_end:
.global _binary_lib_asm_js_start
_binary_lib_asm_js_start:
        .incbin "lib/asm.js"
        .global _binary_lib_asm_js_end
_binary_lib_asm_js_end:
.global _binary_lib_asm_x64_js_start
_binary_lib_asm_x64_js_start:
        .incbin "lib/asm/x64.js"
        .global _binary_lib_asm_x64_js_end
_binary_lib_asm_x64_js_end:
.global _binary_lib_asm_compiler_js_start
_binary_lib_asm_compiler_js_start:
        .incbin "lib/asm/compiler.js"
        .global _binary_lib_asm_compiler_js_end
_binary_lib_asm_compiler_js_end:
.global _binary_lib_proc_js_start
_binary_lib_proc_js_start:
        .incbin "lib/proc.js"
        .global _binary_lib_proc_js_end
_binary_lib_proc_js_end:

`

const addon = `#include <node.h>
#include <lo.h>

extern char _binary_lib_ffi_js_start[];
extern char _binary_lib_ffi_js_end[];
extern char _binary_lib_bench_js_start[];
extern char _binary_lib_bench_js_end[];
extern char _binary_lib_asm_js_start[];
extern char _binary_lib_asm_js_end[];
extern char _binary_lib_asm_x64_js_start[];
extern char _binary_lib_asm_x64_js_end[];
extern char _binary_lib_asm_compiler_js_start[];
extern char _binary_lib_asm_compiler_js_end[];
extern char _binary_lib_proc_js_start[];
extern char _binary_lib_proc_js_end[];

#ifdef __cplusplus
extern "C"
    {
#endif
extern void* _register_core();
extern void* _register_boringssl();
extern void* _register_ada();
extern void* _register_curl();
extern void* _register_heap();
extern void* _register_md4c();
extern void* _register_python();
extern void* _register_luajit();
#ifdef __cplusplus
    }
#endif

void Initialize(v8::Local<v8::Object> exports) {
  v8::Isolate* isolate = v8::Isolate::GetCurrent();
  v8::Local<v8::Context> context = isolate->GetCurrentContext();
  v8::Local<v8::ObjectTemplate> runtime = v8::ObjectTemplate::New(isolate);
  lo::Init(isolate,runtime);
  v8::Local<v8::Object> runtimeInstance = runtime->NewInstance(context).ToLocalChecked();

  lo::builtins_add("lib/ffi.js", _binary_lib_ffi_js_start, _binary_lib_ffi_js_end - _binary_lib_ffi_js_start);
  lo::builtins_add("lib/proc.js", _binary_lib_proc_js_start, _binary_lib_proc_js_end - _binary_lib_proc_js_start);
  lo::builtins_add("lib/bench.js", _binary_lib_bench_js_start, _binary_lib_bench_js_end - _binary_lib_bench_js_start);
  lo::builtins_add("lib/asm.js", _binary_lib_asm_js_start, _binary_lib_asm_js_end - _binary_lib_asm_js_start);
  lo::builtins_add("lib/asm/x64.js", _binary_lib_asm_x64_js_start, _binary_lib_asm_x64_js_end - _binary_lib_asm_x64_js_start);
  lo::builtins_add("lib/asm/compiler.js", _binary_lib_asm_compiler_js_start, _binary_lib_asm_compiler_js_end - _binary_lib_asm_compiler_js_start);

  lo::modules_add("core", &_register_core);
  lo::modules_add("boringssl", &_register_boringssl);
  lo::modules_add("ada", &_register_ada);
  lo::modules_add("curl", &_register_curl);
  lo::modules_add("heap", &_register_heap);
  lo::modules_add("md4c", &_register_md4c);
  lo::modules_add("python", &_register_python);
  lo::modules_add("luajit", &_register_luajit);

  exports->Set(context, v8::String::NewFromUtf8(isolate, "lo")
    .ToLocalChecked(), runtimeInstance).Check();
}


NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)
`


