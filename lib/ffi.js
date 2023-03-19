import { system } from 'lib/system.js'
import { tcc } from 'lib/tcc.js'

const { ffi } = spin.load('ffi')

const { dlopen, dlsym, dlclose } = system
const { bindFastApi, getAddress, compile, CString, assert } = spin

function genFunc (name, params, rtype, cif, address, dv, size) {
  const stack = new ArrayBuffer(size)
  const rdv = new DataView(stack)
  const raddr = getAddress(stack)
  let pos = BigInt(raddr)
  let off = 0
  for (let i = 0; i < params.length; i++) {
    dv.setBigUint64(off, pos, true)
    off += 8
    pos += BigInt(paramSize(params[i]))
  }
  const source = []
  for (let i = 0; i < params.length; i++) {
    source.push(`let l${i}`)
  }
  source.push(`function f (${params.map((v, i) => `p${i}`).join(', ')}${isReturnedAsBigInt(rtype) ? (params.length ? ', vi': 'vi'): ''}) {`)
  let poff = 0
  for (let i = 0; i < params.length; i++) {
    const psize = paramSize(params[i])
    switch (params[i]) {
      case Types.function:
      case Types.buffer:
      case Types.u32array:
        source.push(`  if (p${i} !== l${i}) {`)
        source.push(`    rdv.setBigUint64(${poff}, BigInt(getAddress(p${i}.buffer)), true);`)
        source.push(`    l${i} = p${i}`)
        source.push('  }')
        break;
      case Types.i64:
      case Types.iSize:
        source.push(`  if (p${i} !== l${i}) {`)
        source.push(`    rdv.setBigInt64(${poff}, p${i}, true);`)
        source.push(`    l${i} = p${i}`)
        source.push('  }')
        break;
      case Types.u64:
      case Types.uSize:
      case Types.pointer:
        source.push(`  if (p${i} !== l${i}) {`)
        source.push(`    rdv.setBigUint64(${poff}, BigInt(p${i}), true);`)
        //if (name === 'exec') source.push(`console.log(p${i})`)
        source.push(`    l${i} = p${i}`)
        source.push('  }')
        break;
      case Types.f64:
        source.push(`  if (p${i} !== l${i}) {`)
        source.push(`    rdv.setFloat64(${poff}, p${i}, true);`)
        source.push(`    l${i} = p${i}`)
        source.push('  }')
        break;
      case Types.f32:
        source.push(`  if (p${i} !== l${i}) {`)
        source.push(`    rdv.setFloat32(${poff}, p${i}, true);`)
        source.push(`    l${i} = p${i}`)
        source.push('  }')
        break;
      case Types.i32:
        source.push(`  if (p${i} !== l${i}) {`)
        source.push(`    rdv.setInt32(${poff}, p${i}, true);`)
        source.push(`    l${i} = p${i}`)
        source.push('  }')
        break;
      case Types.u32:
        source.push(`  if (p${i} !== l${i}) {`)
        source.push(`    rdv.setUint32(${poff}, p${i}, true);`)
        source.push(`    l${i} = p${i}`)
        source.push('  }')
        break;
    }
    poff += psize
  }
  if (isReturnedAsBigInt(rtype)) {
    source.push('  const r = ffi.call(cif, address)')
    source.push('  vi[0] = Number(r & 0xffffffffn)')
    source.push('  vi[1] = Number(r >> 32n)')
    source.push('  return')
  } else {
    source.push('  return ffi.call(cif, address)')
  }
  source.push('}')
  source.push('return f')
  const f = new Function('cif', 'address', 'rdv', 'getAddress', 'ffi', source.join('\n').trim())
  return f(cif, address, rdv, getAddress, ffi)
}

function FFIArgtypeFromType (t) {
  if (t === Types.i8) return FFI_TYPE_SINT8
  if (t === Types.i16) return FFI_TYPE_SINT16
  if (t === Types.i32) return FFI_TYPE_SINT32
  if (t === Types.u8) return FFI_TYPE_UINT8
  if (t === Types.u16) return FFI_TYPE_UINT16
  if (t === Types.u32) return FFI_TYPE_UINT32
  if (t === Types.void) return FFI_TYPE_VOID
  if (t === Types.f32) return FFI_TYPE_FLOAT
  if (t === Types.f64) return FFI_TYPE_DOUBLE
  if (t === Types.i64) return FFI_TYPE_SINT64
  if (t === Types.u64) return FFI_TYPE_UINT64
  if (t === Types.iSize) return FFI_TYPE_SINT64
  if (t === Types.uSize) return FFI_TYPE_UINT64
  if (t === Types.buffer) return FFI_TYPE_POINTER
  if (t === Types.u32array) return FFI_TYPE_POINTER
  return FFI_TYPE_POINTER
}

function paramSize (t) {
  if (t === Types.i8) return 1
  if (t === Types.i16) return 2
  if (t === Types.i32) return 4
  if (t === Types.u8) return 1
  if (t === Types.u16) return 2
  if (t === Types.u32) return 4
  if (t === Types.void) return 8
  if (t === Types.f32) return 4
  if (t === Types.f64) return 8
  if (t === Types.i64) return 8
  if (t === Types.u64) return 8
  if (t === Types.iSize) return 8
  if (t === Types.uSize) return 8
  if (t === Types.buffer) return 8
  if (t === Types.u32array) return 8
  return 8
}

function paramsSize (params) {
  let size = 0
  for (let i = 0; i < params.length; i++) {
    size += paramSize(params[i])
  }
  return size
}

function isPointerType(type) {
  return type === Types.buffer || type === Types.pointer
}

function isReturnedAsBigInt(type) {
  return isPointerType(type) || type === Types.u64 || type === Types.i64 ||
    type === Types.uSize || type === Types.iSize
}

function wrapffi (name, address, rtype, params) {
  const dv = new DataView(new ArrayBuffer(8 * params.length))
  const cif = dv.buffer
  const status = ffi.prepare(cif, FFIArgtypeFromType(rtype), params.map(FFIArgtypeFromType))
  if (status !== FFI_OK) throw new Error(`Bad Status ${status}`)
  const size = paramsSize(params)
  return genFunc(name, params, rtype, cif, address, dv, size)
}

function wrapBigIntReturnFn (vui, fn, parameters = []) {
  const call = fn
  const params = parameters.map((_, index) => `p${index}`).join(', ')
  const f = new Function(
    "vui",
    "call",
    `return function (${params}) {
    call(${params}${parameters.length > 0 ? ", " : ""}vui);
    return vui[0] + ((2 ** 32) * vui[1]);
  }`,)
  return f(vui, call)
}

function CRtypeFromType (t) {
  if (t === Types.i8) return 'int8_t'
  if (t === Types.i16) return 'int16_t'
  if (t === Types.i32) return 'int32_t'
  if (t === Types.u8) return 'uint8_t'
  if (t === Types.u16) return 'uint16_t'
  if (t === Types.u32) return 'uint32_t'
  if (t === Types.void) return 'void'
  if (t === Types.f32) return 'float'
  if (t === Types.f64) return 'double'
  if (t === Types.i64) return 'int64_t'
  if (t === Types.u64) return 'uint64_t'
  if (t === Types.iSize) return 'intptr_t'
  if (t === Types.uSize) return 'uintptr_t'
  return 'void*'
}

function CArgtypeFromType (t) {
  if (t === Types.i8) return 'int8_t'
  if (t === Types.i16) return 'int16_t'
  if (t === Types.i32) return 'int32_t'
  if (t === Types.u8) return 'uint8_t'
  if (t === Types.u16) return 'uint16_t'
  if (t === Types.u32) return 'uint32_t'
  if (t === Types.void) return 'void'
  if (t === Types.f32) return 'float'
  if (t === Types.f64) return 'double'
  if (t === Types.i64) return 'int64_t'
  if (t === Types.u64) return 'uint64_t'
  if (t === Types.iSize) return 'intptr_t'
  if (t === Types.uSize) return 'uintptr_t'
  if (t === Types.buffer) return 'struct FastApiTypedArray*'
  if (t === Types.u32array) return 'struct FastApiTypedArray*'
  return 'void*'
}

function CParamsFromParams (params, unwrap = false) {
  let i = 1
  const pp = params.map(t => `${CArgtypeFromType(t)} p${i++}`)
  if (unwrap) {
    pp.push('struct FastApiTypedArray* const p_ret')
  }
  return pp.join(', ')
}

function needsUnwrap (t) {
  switch (t) {
    case Types.function:
    case Types.buffer:
    case Types.pointer:
    case Types.u32array:
    case Types.i64:
    case Types.u64:
    case Types.iSize:
    case Types.uSize:
      return true
    default:
      return false
  }
}

function genTrampoline (name, rtype, params, extern = true) {
  const unwrap = needsUnwrap(rtype)
  const source = []
  if (extern) {
    source.push(`extern ${CRtypeFromType(rtype)} extern_${name}(${CParamsFromParams(params)});`)
  } else {
    source.push(`extern ${CRtypeFromType(rtype)} ${name}(${CParamsFromParams(params)});`)
  }
  if (unwrap) {
    source.push(`${CRtypeFromType(unwrap ? Types.void : rtype)} func_${name} (void* recv, ${CParamsFromParams(params, unwrap)}) {`)
    source.push(`  ${CRtypeFromType(rtype)} r = ${extern ? 'extern_' : ''}${name}(${params.map((t, i) => `p${i + 1}`).join(', ')});`)
    source.push(`  ((${CRtypeFromType(rtype)}*)p_ret->data)[0] = r;`)
  } else {
    source.push(`${CRtypeFromType(unwrap ? Types.void : rtype)} func_${name} (void* recv${params.length ? ', ': ''}${CParamsFromParams(params, unwrap)}) {`)
    source.push(`  return ${extern ? 'extern_' : ''}${name}(${params.map((t, i) => `p${i + 1}`).join(', ')});`)
  }
  source.push(`}`)
  return source.join('\n')
}

const TCC_OUTPUT_MEMORY = 1
const TCC_RELOCATE_AUTO = 1

class Library {
  path = ''
  handle = undefined
  compiler = undefined
  ptr = new Uint32Array(2)
  symbols = {}

  constructor (path = '\0') {
    this.path = path
  }

  pointer () {
    const { ptr } = this
    return ptr[0] + ((2 ** 32) * ptr[1])  
  }

  open () {
    this.handle = dlopen(this.path)
    assert(this.handle)
    this.compiler = tcc.tcc_new()
    assert(this.compiler)
    return this
  }

  compile (src) {
    const source = CString(src)
    const { compiler } = this
    tcc.tcc_set_output_type(compiler, TCC_OUTPUT_MEMORY)
    spin.assert(tcc.tcc_compile_string(compiler, source.ptr) === 0)
    return this
  }

  bind (api, unwrap = true) {
    const { handle, ptr, compiler } = this
    const names = Object.keys(api)
    const lib = {}
    const source = []
    source.push(preamble)
    for (const name of names) {
      const def = api[name]
      const params = def.parameters.map(n => Types[n])
      const rtype = Types[def.result]
      source.push(genTrampoline(name, rtype, params, !def.internal))
    }
    tcc.tcc_set_output_type(compiler, TCC_OUTPUT_MEMORY)
    let rc = tcc.tcc_compile_string(compiler, CString(source.join('\n')).ptr)
    assert(rc === 0, `could not compile (${rc})`)
    for (const name of names) {
      const sym = this.symbols[name] || dlsym(handle, name)
      if (!sym) continue
      this.symbols[name] = sym
      rc = tcc.tcc_add_symbol(compiler, CString(`extern_${name}`).ptr, sym)
      assert(rc === 0, `could not add symbol (${rc})`)
    }
    rc = tcc.tcc_relocate(compiler, TCC_RELOCATE_AUTO)
    assert(rc === 0, `could not relocate (${rc})`)
    for (const name of names) {
      const def = api[name]
      const params = def.parameters.map(n => Types[n])
      const rtype = Types[def.result]
      const sym = this.symbols[name] || tcc.tcc_get_symbol(compiler, CString(name).ptr)
      assert(sym)
      const ffi_func = wrapffi(def.name || name, sym, rtype, params)
      const addr = tcc.tcc_get_symbol(compiler, CString(`func_${name}`).ptr)
      assert(addr, 'could not get symbol')
      if (needsUnwrap(rtype)) {
        if (unwrap) {
          lib[def.name || name] = wrapBigIntReturnFn(ptr, bindFastApi(addr, Types.void, [...params, Types.u32array], ffi_func), params)
        } else {
          lib[def.name || name] = bindFastApi(addr, Types.void, [...params, Types.u32array], ffi_func)
        }
        continue
      }
      lib[def.name || name] = bindFastApi(addr, rtype, params, ffi_func)
    }
    return lib
  }

  close () {
    if (!this.handle) return
    dlclose(this.handle)
    this.handle = undefined
  }
}

const FFI_TYPE_VOID       = 0
const FFI_TYPE_FLOAT      = 2
const FFI_TYPE_DOUBLE     = 3
const FFI_TYPE_UINT8      = 5
const FFI_TYPE_SINT8      = 6
const FFI_TYPE_UINT16     = 7
const FFI_TYPE_SINT16     = 8
const FFI_TYPE_UINT32     = 9
const FFI_TYPE_SINT32     = 10
const FFI_TYPE_UINT64     = 11
const FFI_TYPE_SINT64     = 12
const FFI_TYPE_POINTER    = 14
const FFI_OK = 0

const preamble = `
#ifndef _STDBOOL_H
#define _STDBOOL_H

#define bool _Bool
#define true 1
#define false 0

#endif

typedef signed char int8_t;
typedef short int int16_t;
typedef int int32_t;
typedef long int int64_t;

typedef unsigned char uint8_t;
typedef unsigned short int uint16_t;
typedef unsigned int uint32_t;
typedef unsigned long int uint64_t;

typedef long int intptr_t;
typedef unsigned long int uintptr_t;

struct FastApiTypedArray {
  uintptr_t length_;
  void* data;
};
`

const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18
}

//ffi.wrap = wrap
ffi.Types = Types

const wrap = (address, params = []) => wrapBigIntReturnFn(new Uint32Array(2), address, params)

export { ffi, Library, Types, wrap }
