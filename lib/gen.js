function isNumeric (n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function getType (t, rv = false) {
  if (t === 'i8') return 'int8_t'
  if (t === 'i16') return 'int16_t'
  if (t === 'i32') return 'int32_t'
  if (t === 'u8') return 'uint8_t'
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
    const pType = pointers[index] || 'void*'
    //return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index}->data);`
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
  if (override[index]) {
    return `  ${getType(parameter)} v${index} = p${override[index].param}${override[index].fastfield};`
  } else {
    return `  ${getType(parameter)} v${index} = p${index};`
  }
}

function getSlowParameterCast (parameter, index, pointers, override) {
  if (parameter === 'pointer') {
    const pType = pointers[index] || 'void*'
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
    //return `  ${pType} v${index} = reinterpret_cast<${pType}>(args[${index}].As<Uint8Array>()->Buffer()->Data());`
  }
  if (parameter === 'u32array') {
    const pType = pointers[index] || 'void*'
    return [
      `  Local<Uint32Array> u32${index} = args[${index}].As<Uint32Array>();`,
      `  uint8_t* ptr${index} = (uint8_t*)u32${index}->Buffer()->Data() + u32${index}->ByteOffset();`,
      `  ${pType} v${index} = reinterpret_cast<${pType}>(ptr${index});`
    ].join('\n')
    //return `  ${pType} v${index} = reinterpret_cast<${pType}>(args[${index}].As<Uint32Array>()->Buffer()->Data());`
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

async function bindings (importPath) {
  const { api, includes = [], name, preamble, constants } = await import(importPath)
  const fNames = Object.keys(api)
  for (const name of fNames) {
    const fn = api[name]
    fn.pointers = fn.pointers || []
    fn.name = fn.name || name
  }
  
  function initConstant(n) {
    if (!constants) return ''
    if (!constants.hasOwnProperty(n)) return ''
    const type = constants[n]
    if (type ==='i32' || type === 'u32') {
      return `  SET_VALUE(isolate, module, "${n}", Integer::New(isolate, ${n}));\n`
    }
    if (type ==='u64' || type === 'i64') {
      return `  SET_VALUE(isolate, module, "${n}", BigInt::New(isolate, ${n}));\n`
    }
    if (isNumeric(type)) {
      return `  SET_VALUE(isolate, module, "${n}", Integer::New(isolate, ${type}));\n`
    }
    throw new Error('TODO')
  }

  function initFunction (n) {
    const definition = api[n]
    if (definition.nofast) {
      return `  SET_METHOD(isolate, module, "${n}", ${n}Slow);\n`
    }
    return `  SET_FAST_METHOD(isolate, module, "${n}", &pF${n}, ${n}Slow);\n`
  }

  function getFastFunctionDecl (n) {
    const definition = api[n]
    const { parameters, result, name = n, nofast } = definition
    if (nofast) {
      return ''
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

  function getFunction (n) {
    const definition = api[n]
    const { declare_only, parameters, pointers, result, name = n, rpointer, nofast, casts = [], override = []} = definition
    function getCast (i) {
      return `${casts[i] ? casts[i]: ''}`
    }
    if (declare_only) return ''
    let src = `
void ${n}Slow(const FunctionCallbackInfo<Value> &args) {\n`
    //if ((result !== 'void' && result !== 'pointer') || parameters.includes('pointer') || parameters.includes('string') || parameters.includes('buffer') || parameters.includes('u32array')) {
    if ((result !== 'void' && result !== 'pointer') || parameters.includes('string')) {
      src += `  Isolate *isolate = args.GetIsolate();\n`
    }
    //if (parameters.includes('pointer')) {
    //  src += `\n  Local<Context> context = isolate->GetCurrentContext();\n`
    //}
    src += `${parameters.map((p, i) => getSlowParameterCast(p, i, pointers, override)).join('\n')}\n`
    if (result === 'void') {
      src += `  ${name}(${parameters.map((p, i) => `${p === 'string' ? '*' : getCast(i)}v${i}`).join(', ')});\n`
    } else {
      src += `  ${rpointer || getType(result)} rc = ${name}(${parameters.map((p, i) => `${p === 'string' ? '*' : getCast(i)}v${i}`).join(', ')});\n`
    }
    if (needsUnwrap(result)) {
      if (result === 'pointer') {
        src += `  Local<ArrayBuffer> ab = args[${parameters.length}].As<Uint32Array>()->Buffer();\n`
        src += `  ((${rpointer || getType(result)}*)ab->Data())[0] = rc;\n`
      } else if (result === 'i64') {
        src += `  args.GetReturnValue().Set(Number::New(isolate, static_cast<int64_t>(rc)));\n`
      } else if (result === 'u64') {
        src += `  args.GetReturnValue().Set(Number::New(isolate, static_cast<uint64_t>(rc)));\n`
      }
    } else if (result !== 'void') {
      src += `  args.GetReturnValue().Set(Number::New(isolate, rc));\n`
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
${includes.map(include => `#include <${include}>`).join('\n')}
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
${fNames.map(getFastFunctionDecl).join('')}

${fNames.map(getFunction).join('')}

void Init(Isolate* isolate, Local<ObjectTemplate> target) {
  Local<ObjectTemplate> module = ObjectTemplate::New(isolate);
${fNames.map(initFunction).join('')}
${Object.keys(constants || {}).map(initConstant).join('')}
  SET_MODULE(isolate, target, "${name}", module);
}
} // namespace ${name}
} // namespace ${config.runtime}

extern "C" {
  void* _register_${name}() {
    return (void*)${config.runtime}::${name}::Init;
  }
}`
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

async function wrapper (importPath) {
  const { api, includes, name, libs = [], make, obj = [], deps = [] } = 
    await import(importPath)
  return `
  
`
}

// todo: rename this - this is assembly, not linker script
function linkerScript (fileName) {
  const name = `_binary_${fileName.replace(rx, '_')}`
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

function baseName (path) {
  return path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.'))
}

function extName (path) {
  const pos = path.lastIndexOf('.')
  if (pos < 0) return ''
  return path.slice(pos + 1)
}

const defaultOpts = {
  v8_cleanup: 0,
  v8_threads: 2,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init',
  on_exit: 0
}

function headerFile (deps = [], opts = defaultOpts) {
  const libs = deps.filter(dep => extName(dep) !== 'a')
  const modules = deps.filter(dep => extName(dep) === 'a')
  let source = `#pragma once
// [do not edit,<auto-generated />]
// This file has been automatically generated, please do not change unless you disable auto-generation in the Makefile

#include "${config.runtime}.h"
`
  if (config.os === 'win') {
    source += `
#include "builtins.h"
static unsigned int main_js_len = _binary_main_js_len;
`    
  } else {
    source += `
extern char _binary_main_js_start[];
extern char _binary_main_js_end[];
static unsigned int main_js_len = _binary_main_js_end - _binary_main_js_start;
`
    for (const lib of libs) {
      const name = `_binary_${lib.replace(rx, '_')}`
      source += `extern char ${name}_start[];\n`
      source += `extern char ${name}_end[];\n`
    }
  }
  if (modules.length) {
    source += '\nextern "C" {\n'
  }
  for (const module of modules) {
    source += `  extern void* _register_${baseName(module)}();\n`;
  }
  if (modules.length) source += '}\n'
  if (config.os === 'win') {
    source += `
void register_builtins() {
  ${config.runtime}::builtins_add("main.js", _binary_main_js_start, _binary_main_js_len);
`
    for (const lib of libs) {
      const name = `_binary_${lib.replace(rx, '_')}`
      source += `  ${config.runtime}::builtins_add("${lib}", ${name}_start, ${name}_len);\n`
    }
  } else {
    source += `
void register_builtins() {
  ${config.runtime}::builtins_add("main.js", _binary_main_js_start, _binary_main_js_end - _binary_main_js_start);
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
  source += `}

static const char* main_js = _binary_main_js_start;
static const char* v8flags = "${opts.v8flags}";
static unsigned int _v8flags_from_commandline = ${opts.v8flags ? 1 : 0};
static unsigned int _v8_threads = ${opts.v8_threads};
static unsigned int _v8_cleanup = ${opts.v8_cleanup};
static unsigned int _on_exit = ${opts.on_exit};
`
  return source
}

async function makeFile (importPath) {
  const { api, includes, name, libs = [], make, obj = [], deps = [] } = 
    await import(importPath)
  const HOME = `${config.runtime.toUpperCase()}_HOME`
  return `# [do not edit,<auto-generated />]
# This file has been automatically generated, please do not change unless you disable auto-generation in the Makefile

C=${config.C}
CC=${config.CC}
BINDING=${name}

.PHONY: help clean

${make || ''}
$(BINDING).a: ${obj.filter(o => o !== name).map(o => `${o} `).join('')}## compile static library and dependencies
	$(CC) -fPIC $(CCARGS) $(OPT) -I$(${HOME}) -I$(${HOME})/v8 -I$(${HOME})/v8/include $(WARN) -o $(BINDING).o $(BINDING).cc
	ar crsT $(BINDING).a $(BINDING).o ${obj.filter(o => o !== name).map(o => `${o} `).join('')}

$(BINDING).so: $(BINDING).a ## compile shared library
ifeq ($(os),mac)
	$(CC) -fPIC $(LARGS) $(OPT) -dynamiclib $(WARN) -o $(BINDING).dylib ${obj.filter(o => o !== name).map(o => `${o} `).join('')}$(BINDING).o ${libs.map(l => `-l${l} `).join('')} $(${HOME})/v8/libv8_monolith.a $(${HOME})/${config.runtime}.o
else
	$(CC) $(LARGS) $(OPT) -shared $(WARN) -o $(BINDING).so ${obj.filter(o => o !== name).map(o => `${o} `).join('')}$(BINDING).o ${libs.map(l => `-l${l} `).join('')}
endif

clean: ## tidy up
ifeq ($(os),win)
	@del /q $(BINDING).dll > NUL 2>&1
	@del /q $(BINDING).obj > NUL 2>&1
	@del /q $(BINDING).lib > NUL 2>&1
else
	rm -f $(BINDING).so
	rm -f $(BINDING).a
	rm -f $(BINDING).o
endif

all: ## make all
	make clean
	make $(BINDING).so

.DEFAULT_GOAL := help
`
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const config = { 
  runtime: 'lo',
  C: 'gcc',
  CC: 'g++'
}

async function gen (args) {
  let source = ''
  if (args[0] === '--link') {
    let next = 1
    if (args[1] === '--win') {
      config.os = 'win'
      next = 2
    } else if (args[1] === '--linux') {
      config.os = 'linux'
      next = 2
    }
    source += await linkerScript('main.js')
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
  } else if (args[0] === '--make') {
    source = await makeFile(args[1])
  } else if (args[0] === '--wrap') {
    source = await wrapper(args[1])
  } else {
    source = await bindings(args[0])
  }
  console.log(source)
}

export { bindings, linkerScript, headerFile, wrapper, makeFile, config, gen }
