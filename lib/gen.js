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
  if (rv) {
    if (t === 'buffer') return 'void*'
    if (t === 'pointer') return 'void*'
    if (t === 'u32array') return 'void*'
  } else {
    if (t === 'buffer') return 'uint64_t*'
    if (t === 'pointer') return 'uint64_t*'
    if (t === 'u32array') return 'uint64_t*'
  }
//  if (t === 'buffer') return 'struct FastApiArrayBuffer* const'
//  if (t === 'u32array') return 'struct FastApiArrayBuffer* const'
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
//  if (id === 'buffer') return 'kUint8, CTypeInfo::SequenceType::kIsArrayBuffer, CTypeInfo::Flags::kNone'
//  if (id === 'u32array') return 'kUint32, CTypeInfo::SequenceType::kIsArrayBuffer, CTypeInfo::Flags::kNone'
  if (id === 'buffer') return 'kUint64'
  if (id === 'u32array') return 'kUint64'
  return 'kVoid'
}

function needsUnwrap (t) {
  if (t === 'u8') return false
  if (t === 'i8') return false
  if (t === 'bool') return false
  if (t === 'u16') return false
  if (t === 'i16') return false
  if (t === 'u32') return false
  if (t === 'i32') return false
  if (t === 'f32') return false
  if (t === 'void') return false
  return true
}

function getParams (def) {
  let params
//  console.log(`// ${def.result}`)
  if (needsUnwrap(def.result)) {
    params = [...def.parameters.map((p, i) => `${getType(p)} p${i}`), `${getType('buffer')} p_ret`]
      .filter((p, i) => !(def.override && def.override[i]))
  } else {
    params = def.parameters.map((p, i) => `${getType(p)} p${i}`).filter((p, i) => !(def.override && def.override[i]))
  }
/*
  let params = def.parameters.map((p, i) => `${getType(p)} p${i}`).filter((p, i) => !(def.override && def.override[i]))
  if (needsUnwrap(def.result)) {
    params.push('struct FastApiTypedArray* const p_ret')
  }
*/
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
    return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index});`
//    return [
//      `  Local<Uint8Array> u8${index} = p.As<Uint8Array>();`,
//      `  uint8_t* ptr${index} = (uint8_t*)u8${index}->Buffer()->Data() + u8${index}->ByteOffset();`,
//      `  ${pType} v${index} = reinterpret_cast<${pType}>(ptr${index});`
//    ].join('\n')
  }
  if (parameter === 'u32array') {
    const pType = pointers[index] || 'void*'
//    return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index}->data);`
    return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index});`
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
//    return `  v8::HandleScope scope(args.GetIsolate());\n${pType} v${index} = reinterpret_cast<${pType}>((uint64_t)Local<Integer>::Cast(args[${index}])->Value());`
    return `  ${pType} v${index} = reinterpret_cast<${pType}>((uint64_t)Local<Integer>::Cast(args[${index}])->Value());`
  }
  if (parameter === 'i64') {
    // Explicitly BigInt, and only i64/u64 -- see WORK.md: isz/usz stay
    // plain numbers (like pointer, precise enough for any pointer-sized
    // value on architectures actually targeted here); only genuine i64/
    // u64 values that could realistically need the full 64-bit range use
    // BigInt, kept consistent with lo_abi_v8.cc's own dispatch.
    return `  int64_t v${index} = Local<BigInt>::Cast(args[${index}])->Int64Value();`
  }
  if (parameter === 'u64') {
    return `  uint64_t v${index} = Local<BigInt>::Cast(args[${index}])->Uint64Value();`
  }
  if (parameter === 'string') {
    // TODO: handle error if invalid UTF-8 - length() will be zero and * operator will return NULL
    return `  String::Utf8Value v${index}(isolate, args[${index}]);`
  }
  if (parameter === 'buffer') {
    const pType = pointers[index] || 'void*'
/*
    return [
//      `  Local<Uint8Array> u8${index} = args[${index}].As<Uint8Array>();`,
      `  uint8_t* ptr${index} = (uint8_t*)args[${index}].As<ArrayBuffer>()->Data();`,
      `  ${pType} v${index} = reinterpret_cast<${pType}>(ptr${index});`
    ].join('\n')
*/
    return `  ${pType} v${index} = reinterpret_cast<${pType}>((uint64_t)Local<Integer>::Cast(args[${index}])->Value());`
/*
    return [
      `  Local<Uint8Array> u8${index} = args[${index}].As<Uint8Array>();`,
      `  uint8_t* ptr${index} = (uint8_t*)u8${index}->Buffer()->Data() + u8${index}->ByteOffset();`,
      `  ${pType} v${index} = reinterpret_cast<${pType}>(ptr${index});`
    ].join('\n')
*/
  }
  if (parameter === 'u32array') {
    const pType = pointers[index] || 'void*'
    return `  ${pType} v${index} = reinterpret_cast<${pType}>((uint64_t)Local<Integer>::Cast(args[${index}])->Value());`
/*
    return [
      `  Local<Uint32Array> u32${index} = args[${index}].As<Uint32Array>();`,
      `  uint8_t* ptr${index} = (uint8_t*)u32${index}->Buffer()->Data() + u32${index}->ByteOffset();`,
      `  ${pType} v${index} = reinterpret_cast<${pType}>(ptr${index});`
    ].join('\n')
*/
  }
  if (override[index]) {
    return `  ${getType(parameter)} v${index} = v${override[index].param}${override[index].slowfield};`
  } else {
    return `  ${getType(parameter)} v${index} = Local<Integer>::Cast(args[${index}])->Value();`
  }
}

function getParameterInit(p, i, name) {
  return `  CTypeInfo(CTypeInfo::Type::${getFastType(p)}),`
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
      // BigInt::New takes int64_t -- a u64 constant above INT64_MAX would
      // wrap to negative through that overload (found via the abi target's
      // own cross-codegen test, see test/abi.js's FOO_BIG). NewFromUnsigned
      // is the real full-range-uint64 constructor.
      return `  SET_VALUE(isolate, module, "${n}", BigInt::NewFromUnsigned(isolate, (uint64_t)${n}));\n`
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
    return `  SET_VALUE(isolate, module, "struct_${n.replace(/\s/g, '_')}_size", Integer::New(isolate, sizeof(${n})));\n`
  }

  function initFunction (n, api) {
    const definition = api[n]
    if (definition.nofast || definition.slow) {
      return `  SET_METHOD(isolate, module, "${n}", ${n}Slow);\n`
    }
    return `  SET_FAST_METHOD(isolate, module, "${n}", &pF${n}, ${n}Slow);\n`
  }

  function getFastFunctionDecl (n, api) {
    const definition = api[n]
    const { result, name = n, nofast, slow, override } = definition
    if (nofast || slow) {
      return ''
    }
    let parameters = definition.parameters.slice(0)
    if (override && override.length && override.length >= parameters.length) {
      const overrides_len = override.filter(v => v).length
      parameters = parameters.slice(0, parameters.length - overrides_len)
    }
    if (needsUnwrap(result)) {
      let src = `\nvoid ${n}Fast(void* p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)});`
      //let src = `\nvoid ${n}Fast(v8::Local<v8::Value> p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)});`
      src += `\nCTypeInfo cargs${n}[${parameters.length + 2}] = {\n`
      src += `  CTypeInfo(CTypeInfo::Type::kV8Value),\n`
      src += `${parameters.map((p, i) => getParameterInit(p, i, n)).join('\n')}\n`
      src += `  CTypeInfo(CTypeInfo::Type::kUint64)\n`
//      src += `  CTypeInfo(CTypeInfo::Type::kUint32, CTypeInfo::SequenceType::kIsArrayBuffer, CTypeInfo::Flags::kNone)\n`
      src += '};\n'
      src += `CTypeInfo rc${n} = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo info${n} = CFunctionInfo(rc${n}, ${parameters.length + 2}, cargs${n});
CFunction pF${n} = CFunction((const void*)&${n}Fast, &info${n});\n`
      return src;
    }
    let src = `\n${getType(result, true)} ${n}Fast(void* p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)});`
    //let src = `\n${getType(result, true)} ${n}Fast(v8::Local<v8::Value> p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)});`
    src += `\nCTypeInfo cargs${n}[${parameters.length + 1}] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
${parameters.map((p, i) => getParameterInit(p, i, n)).join('\n')}
};
CTypeInfo rc${n} = CTypeInfo(CTypeInfo::Type::${getFastType(result)});
CFunctionInfo info${n} = CFunctionInfo(rc${n}, ${parameters.length + 1}, cargs${n});
CFunction pF${n} = CFunction((const void*)&${n}Fast, &info${n});\n`
    return src
  }

  function getFunction (n, api) {
    const definition = api[n]
    const { declare_only, parameters, pointers, result, name = n, rpointer, nofast, slow, casts = [], override = []} = definition
    function getCast (i) {
      return `${casts[i] ? casts[i]: ''}`
    }
    if (declare_only) return ''
    let src = `
void ${n}Slow(const FunctionCallbackInfo<Value> &args) {\n`
    //if ((result !== 'void' && result !== 'pointer') || parameters.includes('pointer') || parameters.includes('string') || parameters.includes('buffer') || parameters.includes('u32array')) {
    //if ((result !== 'void' && result !== 'pointer') || parameters.includes('string')) {
    if (needsUnwrap(result) || parameters.includes('string')) {
//    if ((result === 'i64' || result === 'u64') || parameters.includes('string')) {
      src += `  Isolate *isolate = args.GetIsolate();\n`
    }
    //if (parameters.includes('pointer')) {
    //  src += `\n  Local<Context> context = isolate->GetCurrentContext();\n`
    //}
    src += `${parameters.map((p, i) => getSlowParameterCast(p, i, pointers, override)).join('\n')}\n`
    if (result === 'void') {
      src += `  ${name}(${parameters.map((p, i) => `${p === 'string' ? getCast(i) + '*' : getCast(i)}v${i}`).join(', ')});\n`
    } else {
      src += `  ${rpointer || getType(result, true)} rc = ${name}(${parameters.map((p, i) => `${p === 'string' ? `${getCast(i)}*` : getCast(i)}v${i}`).join(', ')});\n`
    }
    if (needsUnwrap(result)) {
      // Only i64/u64 -- genuine 64-bit values that could realistically
      // need the full range -- use BigInt; isz/usz join pointer as plain
      // numbers (precise enough for any pointer-sized value on
      // architectures actually targeted here). Explicit decision, kept
      // consistent with lo_abi_v8.cc's own dispatch -- see WORK.md.
      if (result === 'pointer' || result === 'usz') {
        src += `  args.GetReturnValue().Set(Number::New(isolate, reinterpret_cast<uint64_t>(rc)));\n`

//        src += `  Local<ArrayBuffer> ab = args[${parameters.length - override.filter(v => v).length}].As<Uint32Array>()->Buffer();\n`
//        src += `  ((${rpointer || getType(result)}*)ab->Data())[0] = rc;\n`
      } else if (result === 'isz') {
        src += `  args.GetReturnValue().Set(Number::New(isolate, reinterpret_cast<int64_t>(rc)));\n`
      } else if (result === 'i64') {
        src += `  args.GetReturnValue().Set(BigInt::New(isolate, rc));\n`
      } else if (result === 'u64') {
        src += `  args.GetReturnValue().Set(BigInt::NewFromUnsigned(isolate, rc));\n`
      }
    } else if (result !== 'void') {
      //src += `  args.GetReturnValue().Set(Number::New(isolate, rc));\n`
      src += `  args.GetReturnValue().Set(rc);\n`
    }
    src += `}\n`
    if (nofast || slow) return src
    src += `
${needsUnwrap(result) ? 'void' : getType(result, true)} ${n}Fast(void* p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)}) {
${parameters.map((p, i) => getFastParameterCast(p, i, pointers, override)).join('\n')}`
//${needsUnwrap(definition.result) ? 'void' : getType(result, true)} ${n}Fast(v8::Local<v8::Value> p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)}) {
//${parameters.map((p, i) => getFastParameterCast(p, i, pointers, override)).join('\n')}`
    if (result === 'void') {
      src += `\n  ${name}(${parameters.map((p, i) => `${getCast(i)}v${i}${p === 'string' ? '->data' : ''}`).join(', ')});`
    } else if (needsUnwrap(result)) {
      src += `\n  ${rpointer || getType(result, true)} r = ${name}(${parameters.map((p, i) => `${getCast(i)}v${i}${p === 'string' ? '->data' : ''}`).join(', ')});\n`
//      src += `\n  ((${rpointer || getType(result)}*)p_ret = r;`
      src += `\n  p_ret[0] = (uint64_t)r;`
//      src += `  ((${rpointer || getType(result)}*)p_ret->data)[0] = r;\n`
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

${(linux && linux.includes) ? ['#ifdef __linux__', ...linux.includes.map(include => `#include <${include}>`), '#endif'].join('\n') : ''}
${(mac && mac.includes) ? ['#ifdef __MACH__', ...mac.includes.map(include => `#include <${include}>`).join('\n'), '#endif'] : ''}


#include <${config.runtime}.h>

namespace ${config.runtime} {
namespace ${name} {

using v8::FunctionCallbackInfo;
using v8::Local;
using v8::ObjectTemplate;
using v8::Isolate;
using v8::Value;
using v8::Integer;
using v8::Number;
using v8::FunctionTemplate;
using v8::FunctionCallback;
using v8::CFunction;
using v8::CTypeInfo;
using v8::Uint8Array;
using v8::CFunctionInfo;
using v8::String;
using v8::Uint32Array;
using v8::ArrayBuffer;
using v8::Context;
using v8::Function;
using v8::Object;
using v8::HandleScope;
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

// lo_abi.h-targeted codegen (WORK.E.1's "lib/gen.js codegen integration",
// deferred as a non-goal until lo_abi_v8.cc's own design was validated --
// see doc/WORK.E.1.md's "Result" section). Deliberately narrower than
// bindings() above: only the lo_type_t vocabulary lo_abi_v8.cc's dispatch
// tiers actually implement today (see doc/PROFILING.md/lo_abi_v8.cc's own
// comments) -- no f32/f64 (no register-class handling yet), no u32array/
// function (declared in lo_abi.h, not wired into any dispatch tier yet).
// constants and structs are both supported (lo_exports_set_i32/u64/
// string, see initConstantAbi/initStructAbi below -- E.9; a 'struct' was
// never actual value-marshaling in either codegen, just a sizeof()
// constant, so it needed no new lo_abi.h/lo_abi_v8.cc surface at all).
// Throws clearly at generation time for anything still unsupported
// rather than emitting code that won't compile or would misbehave --
// widen this alongside lo_abi_v8.cc gaining the matching dispatch
// support, not ahead of it.
function getAbiType (t) {
  if (t === 'i8') return 'LO_I8'
  if (t === 'i16') return 'LO_I16'
  if (t === 'i32') return 'LO_I32'
  if (t === 'u8') return 'LO_U8'
  if (t === 'bool') return 'LO_BOOL'
  if (t === 'u16') return 'LO_U16'
  if (t === 'u32') return 'LO_U32'
  if (t === 'void') return 'LO_VOID'
  if (t === 'i64') return 'LO_I64'
  if (t === 'u64') return 'LO_U64'
  if (t === 'isz') return 'LO_ISIZE'
  if (t === 'usz') return 'LO_USIZE'
  if (t === 'string') return 'LO_STRING'
  if (t === 'pointer') return 'LO_POINTER'
  if (t === 'buffer') return 'LO_BUFFER'
  throw new Error(`lib/gen.js (abi target): type '${t}' isn't supported by lo_abi_v8.cc's dispatch yet (no f32/f64/u32array/function -- see doc/WORK.E.1.md)`)
}

// lo_abi.h only declares lo_exports_set_i32/u64/string (E.9 surveyed all
// 43 real bindings' constants: 321 'i32', 26 'u64', 17 'u32', nothing
// else) -- 'u32' shares i32's setter, same as the V8-specific codegen's
// own initConstant does (Integer::New only takes int32_t; every real u32
// constant here is a small flag/limit well under 2^31, confirmed by the
// survey, not assumed), and 'i64' shares u64's setter, matching this
// file's existing i64/u64-both-via-BigInt::NewFromUnsigned convention
// (see lo_abi_v8.cc's SetResult).
function initConstantAbi (n, type) {
  if (type === 'i32' || type === 'u32') {
    return `  lo_exports_set_i32(exports, "${n}", (int32_t)${n});\n`
  }
  if (type === 'u64' || type === 'i64') {
    return `  lo_exports_set_u64(exports, "${n}", (uint64_t)${n});\n`
  }
  if (type === 'string') {
    return `  lo_exports_set_string(exports, "${n}", ${n});\n`
  }
  // Not a type tag at all -- a literal value (e.g. `STDIN: 0`), same as
  // the V8-codegen's own isNumeric(type) fallback (which uses `type`,
  // not `n`, as the value for exactly this reason).
  if (isNumeric(type)) {
    return `  lo_exports_set_i32(exports, "${n}", (int32_t)${type});\n`
  }
  throw new Error(`lib/gen.js (abi target): constant '${n}' has type '${type}', which lo_exports_set_* doesn't support`)
}

// A binding's `structs` array was never actual struct-value marshaling in
// either codegen (a struct-typed parameter is always just 'buffer'/
// 'pointer' underneath -- `pointers: [...]`'s `struct stat *`-style
// strings are a C++ casting annotation for the V8-specific codegen's own
// preamble, not a separate lo_type_t). All `structs` has ever driven is
// exposing `sizeof(name)` as a plain JS-visible constant (initStruct,
// above) -- so it needs exactly the same lo_exports_set_i32 call as any
// other i32 constant, nothing struct-specific.
function initStructAbi (n) {
  return `  lo_exports_set_i32(exports, "struct_${n.replace(/\s/g, '_')}_size", (int32_t)sizeof(${n}));\n`
}

// V8 Fast API Call eligibility/codegen for the abi target (doc/WORK.E.1.md's
// "Update, third follow-on session" -- generalized past the original
// 0-arg/int32-arg proofs of concept once the receiver-shift patch
// landed). Only integer/bool/pointer-class shapes -- no LO_STRING (no
// zero-copy FastOneByteString path here, see WORK.E.1.md's "Open
// question"), no f32/f64 (real register-class work, not done), no
// i64/u64 (need Int64Representation::kBigInt threaded through, not done
// -- isz/usz/pointer/buffer are fine as-is since they're plain Number,
// never BigInt, so they need no such threading).
function getAbiFastCType (t) {
  if (t === 'i8' || t === 'i16' || t === 'i32') return 'int32_t'
  if (t === 'u8' || t === 'u16' || t === 'u32') return 'uint32_t'
  if (t === 'bool') return 'bool'
  if (t === 'isz') return 'int64_t'
  if (t === 'usz' || t === 'pointer' || t === 'buffer') return 'uint64_t'
  if (t === 'void') return 'void'
  return null
}

// Widens a fast-typed parameter into the canonical uint64_t desc->fn is
// actually invoked through -- same convention lo_abi_v8.cc's slow-path
// tiers already use: sign-extend signed types via int64_t first (so a
// negative int32_t doesn't zero-fill the upper 32 bits), zero-extend
// everything else naturally.
function toCanonicalArg (cType, name) {
  if (cType === 'int32_t' || cType === 'int64_t') return `(uint64_t)(int64_t)${name}`
  return `(uint64_t)${name}`
}

function isAbiFastEligible (fn) {
  if (fn.nofast || fn.slow) return false
  if (fn.parameters.length > 6) return false
  if (getAbiFastCType(fn.result) === null) return false
  return fn.parameters.every(p => getAbiFastCType(p) !== null)
}

// Unlike the slow tiers (one shared per-shape dispatcher in lo_abi_v8.cc,
// reused across every registered function via a compile-time slot
// table), a Fast API Call has no such generic escape hatch -- V8 calls
// the entry point directly with real native types in real ABI
// registers, matching CFunctionInfo's declaration exactly. So this
// generates one small, concretely-typed wrapper per eligible function,
// directly in the binding's own generated .cc -- no receiver parameter
// (this repo's own V8 patch, patches/15.3-cfunctioninfo-has-receiver-
// kno.patch, removed the need for one), forwarding to the real function
// through the same canonical-wide-integer-pointer trick the slow path
// already uses and documents (lo_abi_v8.cc's DispatchPrimitiveArgs).
function genAbiFastWrapper (fname, fn) {
  if (!isAbiFastEligible(fn)) return { decl: '', ref: 'nullptr' }
  const resultType = getAbiFastCType(fn.result)
  const isVoid = resultType === 'void'
  const paramTypes = fn.parameters.map(getAbiFastCType)
  const params = paramTypes.map((t, i) => `${t} p${i}`).join(', ')
  const canonicalParams = paramTypes.map(() => 'uint64_t').join(', ')
  const canonicalArgs = paramTypes.map((t, i) => toCanonicalArg(t, `p${i}`)).join(', ')
  const wrapperName = `${fname}_lo_fast`
  const fTypedef = isVoid ? `void (*F)(${canonicalParams})` : `uint64_t (*F)(${canonicalParams})`
  // (void*) first, same as (void*)${fn.name} already does for the slow
  // path's own `fn` field a few lines below -- routes through the
  // type-erased pointer so the compiler doesn't flag this intentional
  // reinterpretation as a function-pointer type mismatch (it would, cast
  // directly between two fully-visible, genuinely different signatures).
  const call = `((F)(void*)${fn.name})(${canonicalArgs})`
  const body = isVoid
    ? `  typedef ${fTypedef};\n  ${call};\n`
    : `  typedef ${fTypedef};\n  uint64_t rv = ${call};\n  return ${resultType === 'bool' ? '(bool)(rv & 1)' : `(${resultType})rv`};\n`
  return { decl: `static ${resultType} ${wrapperName}(${params}) {\n${body}}\n`, ref: `(void*)${wrapperName}` }
}

function bindingsAbi ({ api, name, preamble, constants = {}, structs = [], includes = [], externs = [] }) {
  const constantRows = Object.keys(constants).map(n => initConstantAbi(n, constants[n])).join('') +
    structs.map(initStructAbi).join('')

  const fNames = Object.keys(api)
  for (const fname of fNames) {
    const fn = api[fname]
    fn.name = fn.name || fname
    if (fn.override) {
      throw new Error(`lib/gen.js (abi target): '${name}.${fname}' uses 'override', which the abi target doesn't support yet`)
    }
    getAbiType(fn.result)
    for (const p of fn.parameters) getAbiType(p)
  }

  const paramArrays = fNames.filter(fname => api[fname].parameters.length).map(fname => {
    const fn = api[fname]
    return `static const lo_type_t ${fname}_params[] = { ${fn.parameters.map(getAbiType).join(', ')} };\n`
  }).join('')

  const fastWrappers = fNames.map(fname => genAbiFastWrapper(fname, api[fname]))
  const fastWrapperDecls = fastWrappers.map(w => w.decl).join('')

  const descRows = fNames.map((fname, i) => {
    const fn = api[fname]
    const paramsRef = fn.parameters.length ? `${fname}_params` : 'nullptr'
    return `  { "${fname}", ${getAbiType(fn.result)}, ${paramsRef}, ${fn.parameters.length}, (void*)${fn.name}, ${fastWrappers[i].ref}, 0 },\n`
  }).join('')

  return `
// [do not edit,<auto-generated />]
// This file has been automatically generated (abi target), please do not
// change unless you disable auto-generation -- see doc/WORK.E.1.md.
// This binding's own code never writes v8:: directly, or even touches
// it indirectly -- lo_abi_v8.cc is the only file allowed to (LO_ABI_V8_
// REGISTER below calls a fully portable, engine-agnostic function; the
// real v8:: work happens entirely inside lo_abi_v8.cc, compiled once
// into the runtime, not into this binding -- see lo_abi.h's own comment
// on lo_abi_v8_register_binding for what this replaced and why).

#include "lo_abi.h"

${includes.map(include => {
  const wrap = externs.includes(include)
  return `${wrap ? '#ifdef __cplusplus\nextern "C" {\n#endif\n' : ''}#include <${include}>\n${wrap ? '#ifdef __cplusplus\n}\n#endif\n' : ''}`
}).join('')}
${preamble || ''}

${paramArrays}${fastWrapperDecls}static const lo_fn_desc_t ${name}_fns[] = {
${descRows}};

LO_REGISTER(${name}) {
  lo_status_t status = lo_register_functions(engine, exports, ${name}_fns,
    sizeof(${name}_fns) / sizeof(${name}_fns[0]));
  if (status != LO_OK) return status;
${constantRows}  return LO_OK;
}

LO_ABI_V8_REGISTER(${name})
`
}

const rx = /[./-]/g

let readFile
if (globalThis.Deno) {
  readFile = fn => Deno.readFileSync(fn)
} else if (globalThis.Bun) {
  const fs = require('fs')
  readFile = fn => new Uint8Array(fs.readFileSync(fn))
} else if (globalThis.process?.versions?.node) {
  const fs = await import('node:fs')
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
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation',
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
//    source += await linkerScript('main.js')
    for (const fileName of args.slice(next)) {
      source += await linkerScript(fileName, lo.getcwd())
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
  return source
}

export {
  bindings, bindingsAbi, linkerScript, headerFile, linkArgs, libPaths, config, gen
}
