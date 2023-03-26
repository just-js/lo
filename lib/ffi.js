const { tcc } = spin.load('tcc')
const { ffi } = spin.load('ffi')

const { ffi_prep_cif } = ffi

const handle = new Uint32Array(2)
tcc.tcc_new = spin.wrap(handle, tcc.tcc_new, 0)
tcc.tcc_get_symbol = spin.wrap(handle, tcc.tcc_get_symbol, 2)

const {
  dlopen, dlsym, getAddress, bindFastApi, cstr, assert, dlclose, ptr
} = spin

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
  if (t === Types.string) return FFI_TYPE_POINTER
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
  if (t === Types.string) return 8
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
  return type === Types.buffer || type === Types.pointer || type === Types.string
}

function isReturnedAsBigInt(type) {
  return isPointerType(type) || type === Types.u64 || type === Types.i64 ||
    type === Types.uSize || type === Types.iSize
}

function ffitypes (types) {
  const u8 = ptr(new Uint8Array(8 * types.length))
  const dv = new DataView(u8.buffer)
  let off = 0
  for (let i = 0; i < types.length; i++) {
    dv.setBigUint64(off, BigInt(ffi_type[types[i]].ptr), true)
    off += 8
  }
  return u8
}

class FFIFunction {
  constructor (address, rtype, params = []) {
    this.cif = ptr(new Uint8Array(32))
    this.args = ffitypes(params.map(FFIArgtypeFromType))
    this.rc = ffi_type[FFIArgtypeFromType(rtype)]
    this.length = params.length
    this.size = paramsSize(params)
    this.stack = ptr(new Uint8Array(this.size))
    this.rdv = new DataView(this.stack.buffer)
    this.res = ptr(new Uint32Array(2))
    this.cargs = ptr(new Uint8Array(8 * params.length))
    this.params = params
    this.rtype = rtype
    this.address = address
  }

  prepare () {
    const { cif, args, length, rc, params, rtype, address } = this
    const status = ffi_prep_cif(cif.ptr, FFI_LAST_ABI, length, 
      rc.ptr, args.ptr)
    if (status !== FFI_OK) throw new Error(`Bad Status ${status}`)
    const { cargs, res, rdv, stack } = this
    let pos = stack.ptr
    let off = 0
    const dv = new DataView(cargs.buffer)
    for (let i = 0; i < length; i++) {
      dv.setBigUint64(off, BigInt(pos), true)
      off += 8
      pos += paramSize(params[i])
    }
    const source = []
    const P32 = Math.pow(2, 32)
    const strings = (new Array(64)).fill(0).map(e => ptr(new Uint8Array(4096)))
    const strptrs = strings.map(s => s.ptr)
    source.push(`function f (${params.map((v, i) => `p${i}`).join(', ')}${isReturnedAsBigInt(rtype) ? (params.length ? ', vi': 'vi'): ''}) {`)
    let poff = 0
    for (let i = 0; i < params.length; i++) {
      const psize = paramSize(params[i])
      switch (params[i]) {
        case Types.function:
        case Types.buffer:
        case Types.u32array:
          source.push(`  const ptr${i} = getAddress(p${i})`)
          source.push(`  rdv.setUint32(${poff}, ptr${i} & 0xffffffff, true)`)
          source.push(`  rdv.setUint32(${poff + 4}, Math.floor(ptr${i} / P32), true)`)
          break;
        case Types.i64:
        case Types.iSize:
          source.push(`  rdv.setUint32(${poff}, p${i} & 0xffffffff, true)`)
          source.push(`  rdv.setUint32(${poff + 4}, Math.floor(p${i} / P32), true)`)
          break;
        case Types.string:
          source.push(`  spin.utf8EncodeInto(p${i}, strings[${i}])`)
          source.push(`  const ptr${i} = strptrs[${i}]`)
          source.push(`  rdv.setUint32(${poff}, ptr${i} & 0xffffffff, true)`)
          source.push(`  rdv.setUint32(${poff + 4}, Math.floor(ptr${i} / P32), true)`)
          break;
        case Types.u64:
        case Types.uSize:
        case Types.pointer:
          source.push(`  rdv.setUint32(${poff}, p${i} & 0xffffffff, true)`)
          source.push(`  rdv.setUint32(${poff + 4}, Math.floor(p${i} / P32), true)`)
          break;
        case Types.f64:
          source.push(`  rdv.setFloat64(${poff}, p${i}, true);`)
          break;
        case Types.f32:
          source.push(`  rdv.setFloat32(${poff}, p${i}, true);`)
          break;
        case Types.i32:
          source.push(`  rdv.setInt32(${poff}, p${i}, true);`)
          break;
        case Types.u32:
          source.push(`  rdv.setUint32(${poff}, p${i}, true);`)
          break;
      }
      poff += psize
    }
    source.push('  ffi_call(cif, address, res.ptr, cargs)')
    if (needsUnwrap(rtype)) {
      source.push('  vi[0] = res[0]')
      source.push('  vi[1] = res[1]')
    } else {
      source.push('  return res[0]')
    }
    source.push('}')
    source.push('return f')
    console.log(source.join('\n'))
    const f = new Function('cif', 'address', 'rdv', 'getAddress', 'ffi_call', 'res', 'cargs', 'P32', 'strings', 'strptrs', source.join('\n').trim())
    this.call = f(cif.ptr, address, rdv, getAddress, ffi.ffi_call, res, cargs.ptr, P32, strings, strptrs)
    return this
  }
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
  if (t === Types.string) return 'struct FastOneByteString*'
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

function CParamsFromParams2 (params, unwrap = false) {
  let i = 1
  const pp = params.map(t => `${(t === Types.string || t === Types.buffer) ? 'void*' : CArgtypeFromType(t)} p${i++}`)
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
    case Types.string:
      return true
    default:
      return false
  }
}

function genTrampoline (name, rtype, params, extern = true) {
  const unwrap = needsUnwrap(rtype)
  const source = []
  if (extern) {
    source.push(`extern ${CRtypeFromType(rtype)} extern_${name}(${CParamsFromParams2(params)});`)
  } else {
    source.push(`extern ${CRtypeFromType(rtype)} ${name}(${CParamsFromParams2(params)});`)
  }
  if (unwrap) {
    source.push(`${CRtypeFromType(unwrap ? Types.void : rtype)} func_${name} (void* recv, ${CParamsFromParams(params, unwrap)}) {`)
    source.push(`  ${CRtypeFromType(rtype)} r = ${extern ? 'extern_' : ''}${name}(${params.map((t, i) => `p${i + 1}${(t === Types.string || t === Types.buffer) ? '->data' : ''}`).join(', ')});`)
    source.push(`  ((${CRtypeFromType(rtype)}*)p_ret->data)[0] = r;`)
  } else {
    source.push(`${CRtypeFromType(unwrap ? Types.void : rtype)} func_${name} (void* recv${params.length ? ', ': ''}${CParamsFromParams(params, unwrap)}) {`)
    source.push(`  return ${extern ? 'extern_' : ''}${name}(${params.map((t, i) => `p${i + 1}${(t === Types.string || t === Types.buffer) ? '->data' : ''}`).join(', ')});`)
  }
  source.push(`}`)
  //console.log(source.join('\n'))
  return source.join('\n')
}

class Library {
  path = ''
  handle = 0 // can use dlsym with handle of 0 for current process
  compiler = undefined
  ptr = new Uint32Array(2)
  symbols = {}

  pointer () {
    const { ptr } = this
    return ptr[0] + ((2 ** 32) * ptr[1])  
  }

  open (path = '\0') {
    this.handle = dlopen(path, 1)
    assert(this.handle)
    this.compiler = tcc.tcc_new()
    assert(this.compiler)
    this.path = path
    return this
  }

  compile (src, objFileName = '') {
    if (!this.compiler) {
      this.compiler = tcc.tcc_new()
      assert(this.compiler)
    }
    const source = cstr(src)
    const { compiler } = this
    if (objFileName) {
      tcc.tcc_set_output_type(compiler, TCC_OUTPUT_OBJ)
      spin.assert(tcc.tcc_compile_string(compiler, source.ptr) === 0)
      spin.assert(tcc.tcc_output_file(compiler, cstr(objFileName).ptr) === 0)
    } else {
      tcc.tcc_set_output_type(compiler, TCC_OUTPUT_MEMORY)
      spin.assert(tcc.tcc_compile_string(compiler, source.ptr) === 0)
    }
    return this
  }

  bind (api) {
    if (!this.compiler) {
      this.compiler = tcc.tcc_new()
      assert(this.compiler)
    }
    const { handle, compiler } = this
    const names = Object.keys(api)
    const lib = {}
    const source = [preamble]
    for (const name of names) {
      const def = api[name]
      const params = def.parameters.map(n => Types[n])
      const rtype = Types[def.result]
      source.push(genTrampoline(name, rtype, params, !def.internal))
    }
    tcc.tcc_set_output_type(compiler, TCC_OUTPUT_MEMORY)
    let rc = tcc.tcc_compile_string(compiler, cstr(source.join('\n')).ptr)
    assert(rc === 0, `could not compile (${rc})`)
    for (const name of names) {
      const def = api[name]
      const sname = def.name || name
      const sym = this.symbols[name] || dlsym(handle, sname)
      if (!sym) continue
      this.symbols[name] = sym
      rc = tcc.tcc_add_symbol(compiler, cstr(`extern_${name}`).ptr, sym)
      assert(rc === 0, `could not add symbol (${rc})`)
    }
    rc = tcc.tcc_relocate(compiler, TCC_RELOCATE_AUTO)
    assert(rc === 0, `could not relocate (${rc})`)
    for (const name of names) {
      const def = api[name]
      const sname = def.name || name
      const params = def.parameters.map(n => Types[n])
      const rtype = Types[def.result]
      const sym = this.symbols[name] || tcc.tcc_get_symbol(compiler, cstr(sname).ptr)
      assert(sym)
      const addr = tcc.tcc_get_symbol(compiler, cstr(`func_${name}`).ptr)
      assert(addr, 'could not get symbol')
      lib[name] = bindFastApi(sym, addr, rtype, params)
      if (needsUnwrap(rtype)) {
        lib[name] = spin.wrap(new Uint32Array(2), lib[name], def.parameters.length)
      }
    }
    return lib
  }

  close () {
    if (!this.handle) return
    dlclose(this.handle)
    this.handle = undefined
  }
}


// todo: FastOneByteString should be const char*
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

struct FastOneByteString {
  char* data;
  uint32_t length;
};

`
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
const FFI_OK              = 0
const FFI_LAST_ABI        = 2

const TCC_OUTPUT_MEMORY   = 1
const TCC_OUTPUT_EXE = 2
const TCC_OUTPUT_DLL = 3
const TCC_OUTPUT_OBJ = 4
const TCC_RELOCATE_AUTO   = 1

tcc.TCC_OUTPUT_MEMORY = TCC_OUTPUT_MEMORY
tcc.TCC_RELOCATE_AUTO = TCC_RELOCATE_AUTO

const ffi_type = {}

const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18, string: 19
}

const ffi_types = [
  [1, 1, FFI_TYPE_UINT8], [1, 1, FFI_TYPE_SINT8], [2, 2, FFI_TYPE_UINT16],
  [2, 2, FFI_TYPE_SINT16], [4, 4, FFI_TYPE_UINT32], [4, 4, FFI_TYPE_SINT32],
  [8, 8, FFI_TYPE_UINT64], [8, 8, FFI_TYPE_SINT64], [8, 8, FFI_TYPE_POINTER],
  [4, 4, FFI_TYPE_FLOAT], [8, 8, FFI_TYPE_DOUBLE], [1, 1, FFI_TYPE_VOID]
]

ffi_types.forEach(t => {
  const [size, alignment, type] = t
  const u8 = ptr(new Uint8Array(24))
  const dv = new DataView(u8.buffer)
  dv.setBigUint64(0, BigInt(size), true)
  dv.setUint16(8, alignment, true)
  dv.setUint16(10, type, true)
  ffi_type[type] = u8
})

export { Library, Types, FFIFunction, tcc }
