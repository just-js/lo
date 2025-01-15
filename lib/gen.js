import { join } from 'lib/path.js'

function isNumeric (n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function getType (t, rv = false) {
  if (t === 'i8') return 'int8_t'
  if (t === 'i16') return 'int16_t'
  if (t === 'i32') return 'int32_t'
  if (t === 'u8') return 'uint8_t'
  if (t === 'bool') return 'uint8_t'
  if (t === 'u16') return 'uint16_t'
  if (t === 'u32') return 'uint32_t'
  if (t === 'void') return 'void'
  if (t === 'f32') return 'float'
  if (t === 'f64') return 'double'
  if (t === 'i64') return 'int64_t'
  if (t === 'u64') return 'uint64_t'
  if (t === 'isz') return 'intptr_t'
  if (t === 'usz') return 'uintptr_t'
  if (t === 'string') return 'struct FastOneByteString* const'
  if (t === 'buffer') return 'struct FastApiTypedArray* const'
  if (t === 'u32array') return 'struct FastApiTypedArray* const'
  if (rv) return 'void'
  return 'void*'
}

function getFastType (id = '') {
  if (id === 'u8') return 'kUint8'
  if (id === 'bool') return 'kUint8'
  if (id === 'u32') return 'kUint32'
  if (id === 'i32') return 'kInt32'
  if (id === 'pointer') return 'kUint64'
  if (id === 'void') return 'kVoid'
  if (id === 'u64') return 'kUint64'
  if (id === 'i64') return 'kInt64'
  if (id === 'f32') return 'kFloat32'
  if (id === 'f64') return 'kFloat64'
  if (id === 'string') return 'kSeqOneByteString'
  if (id === 'buffer') return 'kUint8, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone'
  if (id === 'u32array') return 'kUint32, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone'
  return 'kVoid'
}

function needsUnwrap (t) {
  if (t === 'u8') return false
  if (t === 'bool') return false
  if (t === 'u32') return false
  if (t === 'i32') return false
  if (t === 'f32') return false
  if (t === 'void') return false
  return true
}

function getParams (def) {
  let params = def.parameters.map((p, i) => `${getType(p)} p${i}`).filter((p, i) => !(def.override && def.override[i]))
  if (needsUnwrap(def.result)) {
    params.push('struct FastApiTypedArray* const p_ret')
  }
  return params.join(', ')
}

function getFastParameterCast (parameter, index, pointers, override) {
  if (parameter === 'pointer') {
    const pType = pointers[index] || 'void*'
    return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index});`
  }
  if (parameter === 'string') {
    return `  struct FastOneByteString* const v${index} = p${index};`
  }
  if (parameter === 'buffer') {
    const pType = pointers[index] || 'void*'
    return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index}->data);`
  }
  if (parameter === 'u32array') {
    const pType = pointers[index] || 'void*'
    return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index}->data);`
  }
  if (override.length > index && override[index] !== undefined) {
    if (override[index].constructor.name === 'Object') {
      return `  ${getType(parameter)} v${index} = p${override[index].param}${override[index].fastfield};`
    } else if (override[index].constructor.name === 'Number') {
      return `  ${getType(parameter)} v${index} = ${override[index]};`
    } else if (override[index].constructor.name === 'String') {
      return `  ${getType(parameter)} v${index} = "${override[index]}";`
    } else {
      throw new Error('unsupported override type')
    }
  } else {
    return `  ${getType(parameter)} v${index} = p${index};`
  }
}

function getSlowParameterCast (parameter, index, pointers, override) {
//  if (parameter === 'pointer64') {
//    const pType = pointers[index] || 'void*'
//    return `  ${pType} v${index} = reinterpret_cast<${pType}>((uint64_t)Local<BigInt>::Cast(args[${index}])->Uint64Value());`
//  }
  if (parameter === 'pointer') {
    const pType = pointers[index] || 'void*'
//    return `  ${pType} v${index} = reinterpret_cast<${pType}>((uint64_t)Local<BigInt>::Cast(args[${index}])->Uint64Value());`
    return `  ${pType} v${index} = reinterpret_cast<${pType}>((uint64_t)Local<Integer>::Cast(args[${index}])->Value());`
  }
  if (parameter === 'string') {
    // TODO: handle error if invalid UTF-8 - length() will be zero and * operator will return NULL
    return `  String::Utf8Value v${index}(isolate, args[${index}]);`
  }
  if (parameter === 'buffer') {
    const pType = pointers[index] || 'void*'
    return [
      `  Local<Uint8Array> u8${index} = args[${index}].As<Uint8Array>();`,
      `  uint8_t* ptr${index} = (uint8_t*)u8${index}->Buffer()->Data() + u8${index}->ByteOffset();`,
      `  ${pType} v${index} = reinterpret_cast<${pType}>(ptr${index});`
    ].join('\n')
  }
  if (parameter === 'u32array') {
    const pType = pointers[index] || 'void*'
    return [
      `  Local<Uint32Array> u32${index} = args[${index}].As<Uint32Array>();`,
      `  uint8_t* ptr${index} = (uint8_t*)u32${index}->Buffer()->Data() + u32${index}->ByteOffset();`,
      `  ${pType} v${index} = reinterpret_cast<${pType}>(ptr${index});`
    ].join('\n')
  }
  if (override[index]) {
    return `  ${getType(parameter)} v${index} = v${override[index].param}${override[index].slowfield};`
  } else {
    return `  ${getType(parameter)} v${index} = Local<Integer>::Cast(args[${index}])->Value();`
  }
}

function getParameterInit(p, i, name) {
  return `  v8::CTypeInfo(v8::CTypeInfo::Type::${getFastType(p)}),`
}

function bindings ({ api, includes = [], name, preamble, constants, structs = [], linux, mac, externs = [] }) {

  const fNames = []
  const linuxfNames = []
  const macfNames = []

  for (const name of Object.keys(api)) {
    const fn = api[name]
    fn.pointers = fn.pointers || []
    fn.name = fn.name || name
    fNames.push(name)
  }
  if (linux && linux.api) {
    for (const name of Object.keys(linux.api)) {
      const fn = linux.api[name]
      fn.pointers = fn.pointers || []
      fn.name = fn.name || name
      linuxfNames.push(name)
    }
  }
  if (mac && mac.api) {
    for (const name of Object.keys(mac.api)) {
      const fn = linux.api[name]
      fn.pointers = fn.pointers || []
      fn.name = fn.name || name
      macfNames.push(name)
    }
 }

  function initConstant(n, constants) {
    if (!constants) return ''
    if (!constants.hasOwnProperty(n)) return ''
    const type = constants[n]
    if (type === 'u32') {
      return `  SET_VALUE(isolate, module, "${n}", Integer::New(isolate, (uint32_t)${n}));\n`
    }
    if (type ==='i32') {
      return `  SET_VALUE(isolate, module, "${n}", Integer::New(isolate, (int32_t)${n}));\n`
    }
    if (type ==='u64') {
      return `  SET_VALUE(isolate, module, "${n}", BigInt::New(isolate, (uint64_t)${n}));\n`
    }
    if (type ==='i64') {
      return `  SET_VALUE(isolate, module, "${n}", BigInt::New(isolate, (int64_t)${n}));\n`
    }
    if (isNumeric(type)) {
      return `  SET_VALUE(isolate, module, "${n}", Number::New(isolate, (int64_t)${type}));\n`
    }
    throw new Error('TODO')
  }

  function initStruct(n) {
    return `  SET_VALUE(isolate, module, "struct_${n}_size", Integer::New(isolate, sizeof(${n})));\n`
  }

  function initFunction (n, api) {
    const definition = api[n]
    if (definition.nofast) {
      return `  SET_METHOD(isolate, module, "${n}", ${n}Slow);\n`
    }
    return `  SET_FAST_METHOD(isolate, module, "${n}", &pF${n}, ${n}Slow);\n`
  }

  function getFastFunctionDecl (n, api) {
    const definition = api[n]
    const { result, name = n, nofast, override } = definition
    if (nofast) {
      return ''
    }
    let parameters = definition.parameters.slice(0)
    if (override && override.length && override.length >= parameters.length) {
      const overrides_len = override.filter(v => v).length
      parameters = parameters.slice(0, parameters.length - overrides_len)
    }
    if (needsUnwrap(result)) {
      let src = `\nvoid ${n}Fast(void* p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)});`
      src += `\nv8::CTypeInfo cargs${n}[${parameters.length + 2}] = {\n`
      src += `  v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value),\n`
      src += `${parameters.map((p, i) => getParameterInit(p, i, n)).join('\n')}\n`
      src += `  v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone)\n`
      src += '};\n'
      src += `v8::CTypeInfo rc${n} = v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
v8::CFunctionInfo info${n} = v8::CFunctionInfo(rc${n}, ${parameters.length + 2}, cargs${n});
v8::CFunction pF${n} = v8::CFunction((const void*)&${n}Fast, &info${n});\n`
      return src;
    }
    let src = `\n${getType(result, true)} ${n}Fast(void* p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)});`
    src += `\nv8::CTypeInfo cargs${n}[${parameters.length + 1}] = {
  v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value),
${parameters.map((p, i) => getParameterInit(p, i, n)).join('\n')}
};
v8::CTypeInfo rc${n} = v8::CTypeInfo(v8::CTypeInfo::Type::${getFastType(result)});
v8::CFunctionInfo info${n} = v8::CFunctionInfo(rc${n}, ${parameters.length + 1}, cargs${n});
v8::CFunction pF${n} = v8::CFunction((const void*)&${n}Fast, &info${n});\n`
    return src
  }

  function getFunction (n, api) {
    const definition = api[n]
    const { declare_only, parameters, pointers, result, name = n, rpointer, nofast, casts = [], override = []} = definition
    function getCast (i) {
      return `${casts[i] ? casts[i]: ''}`
    }
    if (declare_only) return ''
    let src = `
void ${n}Slow(const FunctionCallbackInfo<Value> &args) {\n`
    //if ((result !== 'void' && result !== 'pointer') || parameters.includes('pointer') || parameters.includes('string') || parameters.includes('buffer') || parameters.includes('u32array')) {
    //if ((result !== 'void' && result !== 'pointer') || parameters.includes('string')) {
    if ((result === 'i64' || result === 'u64') || parameters.includes('string')) {
      src += `  Isolate *isolate = args.GetIsolate();\n`
    }
    //if (parameters.includes('pointer')) {
    //  src += `\n  Local<Context> context = isolate->GetCurrentContext();\n`
    //}
    src += `${parameters.map((p, i) => getSlowParameterCast(p, i, pointers, override)).join('\n')}\n`
    if (result === 'void') {
      src += `  ${name}(${parameters.map((p, i) => `${p === 'string' ? getCast(i) + '*' : getCast(i)}v${i}`).join(', ')});\n`
    } else {
      src += `  ${rpointer || getType(result)} rc = ${name}(${parameters.map((p, i) => `${p === 'string' ? `${getCast(i)}*` : getCast(i)}v${i}`).join(', ')});\n`
    }
    if (needsUnwrap(result)) {
      if (result === 'pointer') {
        src += `  Local<ArrayBuffer> ab = args[${parameters.length - override.filter(v => v).length}].As<Uint32Array>()->Buffer();\n`
        src += `  ((${rpointer || getType(result)}*)ab->Data())[0] = rc;\n`
      } else if (result === 'i64') {
        src += `  args.GetReturnValue().Set(Number::New(isolate, static_cast<int64_t>(rc)));\n`
      } else if (result === 'u64') {
        src += `  args.GetReturnValue().Set(Number::New(isolate, static_cast<uint64_t>(rc)));\n`
      }
    } else if (result !== 'void') {
      //src += `  args.GetReturnValue().Set(Number::New(isolate, rc));\n`
      src += `  args.GetReturnValue().Set(rc);\n`
    }
    src += `}\n`
    if (nofast) return src
    src += `
${needsUnwrap(definition.result) ? 'void' : getType(result, true)} ${n}Fast(void* p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)}) {
${parameters.map((p, i) => getFastParameterCast(p, i, pointers, override)).join('\n')}`
    if (result === 'void') {
      src += `\n  ${name}(${parameters.map((p, i) => `${getCast(i)}v${i}${p === 'string' ? '->data' : ''}`).join(', ')});`
    } else if (needsUnwrap(result)) {
      src += `\n  ${rpointer || getType(result)} r = ${name}(${parameters.map((p, i) => `${getCast(i)}v${i}${p === 'string' ? '->data' : ''}`).join(', ')});\n`
      src += `  ((${rpointer || getType(result)}*)p_ret->data)[0] = r;\n`
    } else {
      src += `\n  return ${name}(${parameters.map((p, i) => `${getCast(i)}v${i}${p === 'string' ? '->data' : ''}`).join(', ')});`
    }
    src += '\n}'
    return src
  }
  return `
// [do not edit,<auto-generated />]
// This file has been automatically generated, please do not change unless you disable auto-generation in the Makefile  
${includes.map(include => {
  let include_text = ''
  if (externs.includes(include)) {
    include_text += `
#ifdef __cplusplus
extern "C"
    {
#endif
`
  }
  include_text += `#include <${include}>\n`
  if (externs.includes(include)) {
    include_text += `
#ifdef __cplusplus
    }
#endif
`
  }
  return include_text
}).join('\n')}

#ifdef __linux__
${(linux && linux.includes) ? linux.includes.map(include => `#include <${include}>`).join('\n') : ''}
#endif

#ifdef __MACH__
${(mac && mac.includes) ? mac.includes.map(include => `#include <${include}>`).join('\n') : ''}
#endif

#include <${config.runtime}.h>

namespace ${config.runtime} {
namespace ${name} {

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
using v8::kPromiseRejectAfterResolved;
using v8::kPromiseResolveAfterResolved;
using v8::kPromiseHandlerAddedAfterReject;
using v8::Data;
using v8::PrimitiveArray;
using v8::TypedArray;
using v8::Uint8Array;
using v8::Boolean;
using v8::ModuleRequest;
using v8::CFunctionInfo;
using v8::OOMDetails;
using v8::V8;
using v8::BigInt;

${preamble || ''}
#ifdef __linux__
${linux?.preamble || ''}
#endif
#ifdef __MACH__
${mac?.preamble || ''}
#endif
${fNames.map(n => getFastFunctionDecl(n, api)).join('')}
#ifdef __linux__
${linuxfNames.map(n => getFastFunctionDecl(n, linux.api)).join('')}
#endif
#ifdef __MACH__
${macfNames.map(n => getFastFunctionDecl(n, mac.api)).join('')}
#endif
${fNames.map(n => getFunction(n, api)).join('')}
#ifdef __linux__
${linuxfNames.map(n => getFunction(n, linux.api)).join('')}
#endif
#ifdef __MACH__
${macfNames.map(n => getFunction(n, mac.api)).join('')}
#endif
void Init(Isolate* isolate, Local<ObjectTemplate> target) {
  Local<ObjectTemplate> module = ObjectTemplate::New(isolate);
${fNames.map(n => initFunction(n, api)).join('')}
#ifdef __linux__
${linuxfNames.map(n => initFunction(n, linux.api)).join('')}
#endif
#ifdef __MACH__
${macfNames.map(n => initFunction(n, mac.api)).join('')}
#endif
${Object.keys(constants || {}).map(n => initConstant(n, constants)).join('')}
#ifdef __linux__
${(linux && linux.constants) ? Object.keys(linux.constants || {}).map(n => initConstant(n, linux.constants)).join('') : ''}
#endif
#ifdef __MACH__
${(mac && mac.constants) ? Object.keys(mac.constants || {}).map(n => initConstant(n, mac.constants)).join('') : ''}
#endif

#ifdef __MACH__
${[...structs, ...(mac?.structs || [])].map(initStruct).join('')}
#endif
#ifdef __linux__
${[...structs, ...(linux?.structs || [])].map(initStruct).join('')}
#endif
  SET_MODULE(isolate, target, "${name}", module);
}
} // namespace ${name}
} // namespace ${config.runtime}

extern "C"  {
  DLL_PUBLIC void* _register_${name}() {
    return (void*)${config.runtime}::${name}::Init;
  }
}
`
}

const rx = /[./-]/g

let readFile
if (globalThis.Deno) {
  readFile = fn => Deno.readFileSync(fn)
} else if (globalThis.Bun) {
  const fs = require('fs')
  readFile = fn => new Uint8Array(fs.readFileSync(fn))
} else {
  readFile = lo.core.readFile
}

// todo: rename this - this is assembly, not linker script
function linkerScript (fileName, parent_path = '') {
  const name = `_binary_${fileName.replace(rx, '_')}`
  if (parent_path) fileName = `${parent_path}/${fileName}`
  if (config.os !== 'win') {
    if (config.os === 'linux') {
      return `.global ${name}_start
${name}_start:
        .incbin "${fileName}"
        .global ${name}_end
${name}_end:
`
    }
  return `.global _${name}_start
_${name}_start:
        .incbin "${fileName}"
        .global _${name}_end
_${name}_end:
`
  }
  const bytes = readFile(fileName)
  const src = `
const char ${name}_start[] = {
${Array.from(bytes).map(b => '0x' + b.toString(16)).join(', ')}
}; 
unsigned int ${name}_len = ${bytes.length};
`
  return src
}

function fileName (path) {
  return path.slice(path.lastIndexOf('/') + 1)
}

function baseName (path) {
  return path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))
}

function extName (path) {
  const pos = path.lastIndexOf('.')
  if (pos < 0) return ''
  return path.slice(pos + 1)
}

async function linkArgs (deps = [], opts = defaultOpts) {
  const bindings = deps.filter(dep => fileName(dep) === 'api.js')
  const imports = await Promise.all(bindings.map(path => import(path)))
  const link_args = Array.from(new Set(imports.map(b => {
    if (b[config.os]?.libs?.length) {
      return [...b[config.os].libs, ...b.libs]
    }
    return b.libs || []
  }).flat()))
  return link_args.map(l => `-l${l}`)
}

async function libPaths (deps = [], opts = defaultOpts) {
  const bindings = deps.filter(dep => fileName(dep) === 'api.js')
  const imports = await Promise.all(bindings.map(path => import(path)))
  const lib_paths = Array.from(new Set(imports.map(b => {
    if (b[config.os]?.lib_paths?.length) {
      const prefix = defaultOpts.prefix || b[config.os].prefix
      if (prefix) {
        return [...b[config.os].lib_paths.map(p => join(prefix, p)), ...b.lib_paths.map(p => join(prefix, p))]
      } else {
        return [...b[config.os].lib_paths, ...b.lib_paths]
      }
    }
    const { prefix } = opts
    if (prefix) {
      return (b.lib_paths || []).map(p => join(prefix, p))
    } else {
      return b.lib_paths || []
    }
  }).flat()))
  return lib_paths.map(l => `-L${l}`)
}

function headerFile (deps = [], index = '', main = 'main.js', opts = defaultOpts) {
  const libs = deps.filter(dep => extName(dep) !== 'a')
  const modules = deps.filter(dep => extName(dep) === 'a')
  let source = `#pragma once
// [do not edit,<auto-generated />]
// This file has been automatically generated, please do not change unless you disable auto-generation in the Makefile

#include "${config.runtime}.h"
`
  const main_name = main.replace(rx, '_')
  if (config.os === 'win') {
    source += `
#include "builtins.h"
static unsigned int ${main_name}_len = _binary_${main_name}_len;
`    
  } else {
    source += `
extern char _binary_${main_name}_start[];
extern char _binary_${main_name}_end[];
static unsigned int ${main_name}_len = _binary_${main_name}_end - _binary_${main_name}_start;
`
    for (const lib of libs) {
      const name = `_binary_${lib.replace(rx, '_')}`
      source += `extern char ${name}_start[];\n`
      source += `extern char ${name}_end[];\n`
    }
  }
  if (modules.length) {
    source += '\nextern "C" {\n'
    for (const module of modules) {
      source += `  extern void* _register_${baseName(module)}();\n`;
    }
    source += '}\n'
  }
  if (config.os === 'win') {
    source += `
void register_builtins() {
  ${config.runtime}::builtins_add("${main}", _binary_${main_name}_start, _binary_${main_name}_len);
`
    for (const lib of libs) {
      const name = `_binary_${lib.replace(rx, '_')}`
      source += `  ${config.runtime}::builtins_add("${lib}", ${name}_start, ${name}_len);\n`
    }
  } else {
    source += `
void register_builtins() {
  ${config.runtime}::builtins_add("${main}", _binary_${main_name}_start, _binary_${main_name}_end - _binary_${main_name}_start);
`
    for (const lib of libs) {
      const name = `_binary_${lib.replace(rx, '_')}`
      source += `  ${config.runtime}::builtins_add("${lib}", ${name}_start, ${name}_end - ${name}_start);\n`
    }
  }
  for (const module of modules) {
    const name = baseName(module)
    source += `  ${config.runtime}::modules_add("${name}", &_register_${name});\n`;
  }
  source += '}\n'
  if (index && libs.includes(index)) {
    const lib = libs.filter(lib => lib === index)[0]
    const name = `_binary_${lib.replace(rx, '_')}`
    source += `static const char* index_js = ${name}_start;
static unsigned int index_js_len = ${name}_end - ${name}_start;
`
  } else {
    source += `static const char* index_js = NULL;
static unsigned int index_js_len = 0;
`
  }
  if (main !== 'main.js') {
    source += `static unsigned int main_js_len = ${main_name}_len;
`
  }
  source += `static const char* main_js = _binary_${main_name}_start;
static const char* v8flags = "${opts.v8flags}";
static unsigned int _v8flags_from_commandline = ${opts.v8flags ? 1 : 0};
static unsigned int _v8_threads = ${opts.v8_threads};
static unsigned int _v8_cleanup = ${opts.v8_cleanup};
static unsigned int _on_exit = ${opts.on_exit};
`
  return source
}

// todo: env vars to override these
const defaultOpts = {
  v8_cleanup: 0,
  v8_threads: 2,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation --max-heap-size 1024',
  on_exit: 0,
  prefix: ''
}

const config = {
  os: 'linux', 
  runtime: 'lo',
  CC: 'gcc',
  CXX: 'g++',
  arch: 'x64'
}

async function gen (args) {
  let source = ''
  if (args[0] === '--builtins') {
    let next = 1
    if (args[1] === '--win') {
      config.os = 'win'
      next = 2
    } else if (args[1] === '--linux') {
      config.os = 'linux'
      next = 2
    }
    if (config.os === 'linux') {
      source += '.section .note.GNU-stack,"",@progbits\n'
    }
//    source += await linkerScript('main.js')
    for (const fileName of args.slice(next)) {
      source += await linkerScript(fileName)
    }
  } else if (args[0] === '--header') {
    let next = 1
    if (args[1] === '--win') {
      config.os = 'win'
      next = 2
    }
    source = await headerFile(args.slice(next))
  } else if (args[0] === '--link') {
    let next = 1
    if (args[1] === '--win') {
      config.os = 'win'
      next = 2
    }
    source = (await linkArgs(args.slice(next))).join(' ')
  } else {
    source = bindings(await import(args[0]))
  }
  console.log(source)
}

export { 
  bindings, linkerScript, headerFile, linkArgs, libPaths, config, gen
}
