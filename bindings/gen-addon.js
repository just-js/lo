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

const rx = /[./-]/g

function createLinkerScript (lib) {
  const name = `_binary_${lib.replace(rx, '_')}`
  return `.global ${name}_start
${name}_start:
        .incbin "${lib}"
        .global ${name}_end
${name}_end:`
}

function genLibExtern (lib) {
  const name = `${lib.replace(rx, '_')}`
  return `extern char _binary_${name}_start[];
extern char _binary_${name}_end[];`
}

function genLibExterns(libs) {
  return libs.map(genLibExtern).join('\n')
}

function genBinaryExtern (binding) {
  return `extern void* _register_${binding}();`
}

function genBindingsExterns(bindings) {
  return bindings.map(genBinaryExtern).join('\n')
}

function getLibInit (lib) {
  const name = `${lib.replace(rx, '_')}`
  return `lo::builtins_add("${lib}", _binary_${name}_start, _binary_${name}_end - _binary_${name}_start);`
}

function genLibInits (libs) {
  return libs.map(getLibInit).join('\n')
}

function genBinaryInit (binding) {
  return `lo::modules_add("${binding}", &_register_${binding});`
}

function genBindingsInits(bindings) {
  return bindings.map(genBinaryInit).join('\n')
}

const linkerScript = libs.map(createLinkerScript).join('\n')

writeFileSync("./builtins_addon.S", linkerScript)
//console.log(linkerScript)

const addon = `#include <node.h>
#include <lo.h>

${genLibExterns(libs)}

#ifdef __cplusplus
extern "C"
    {
#endif
${genBindingsExterns(bindings)}
#ifdef __cplusplus
    }
#endif

void Initialize(v8::Local<v8::Object> exports) {
  v8::Isolate* isolate = v8::Isolate::GetCurrent();
  v8::Local<v8::Context> context = isolate->GetCurrentContext();
  v8::Local<v8::ObjectTemplate> runtime = v8::ObjectTemplate::New(isolate);
  lo::Init(isolate,runtime);
  v8::Local<v8::Object> runtimeInstance = runtime->NewInstance(context).ToLocalChecked();

  ${genLibInits(libs)}

  ${genBindingsInits(bindings)}

  exports->Set(context, v8::String::NewFromUtf8(isolate, "lo")
    .ToLocalChecked(), runtimeInstance).Check();
}


NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)
`

writeFileSync("./addon.cc", addon)

