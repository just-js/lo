// lo_abi_v8.cc — minimal V8 backend for lo_abi.h (WORK.E.1 prototype, see
// doc/WORK.E.1.md). Implements only what an lo_abi.h-targeted binding
// actually calls: lo_register_functions, plus lo_engine_throw/
// lo_engine_has_exception for completeness (cheap, and the closest thing
// this ABI has to a universal error primitive). Everything else lo_abi.h
// declares (lo_exports_set_*, lo_value_*, lo_wrap_memory, the module
// system, engine/realm lifecycle, ...) is intentionally NOT implemented
// here — not needed by this prototype, not claimed to work.
//
// This file is the only place in this prototype that's allowed to touch
// v8:: directly — an lo_abi.h-targeted binding's own .cc never does.

#include "lo.h"
#include "lo_abi.h"

#include <memory>

using namespace v8;

namespace {

// The concrete definition behind the opaque lo_exports_t declared in
// lo_abi.h — "an exports object under construction," backed by a real
// V8 ObjectTemplate for this engine. Lives only as long as one
// registration call (see the shim below) — never persisted past it.
struct ExportsImpl {
  Isolate* isolate;
  Local<ObjectTemplate> tmpl;
};

inline Isolate* AsIsolate(lo_engine_t* engine) {
  return reinterpret_cast<Isolate*>(engine);
}

inline ExportsImpl* AsExports(lo_exports_t* exports) {
  return reinterpret_cast<ExportsImpl*>(exports);
}

// Generic dispatch: one shared V8 callback for every lo_fn_desc_t this
// backend registers. Which descriptor a given call is for travels via
// FunctionTemplate's Data() (the standard V8 mechanism for exactly this).
//
// Known limitations of this first pass (fine for lib/encode_abi, not a
// complete implementation): no LO_F32/LO_F64 (float register class needs
// separate handling on both x64 SysV and ARM64 AAPCS64 -- real work, not
// needed by any binding yet), max 6 params, LO_STRING extraction always
// copies (matches today's String::Utf8Value-based Slow paths -- no attempt
// at V8's zero-copy FastOneByteString path here, see doc/WORK.E.1.md's
// "Open question" section).
constexpr int kMaxArgs = 6;

void GenericDispatch(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  // v8::External::Value()/::New() require an explicit ExternalPointerTypeTag
  // as of this v8/ checkout (V8 15.2) -- same sandboxing-hardening pattern as
  // lo.h's LO_V8_INTERNAL_FIELD_TAG for internal fields, just not yet hit by
  // any other lo binding since this prototype is the first user of
  // v8::External here. kExternalPointerTypeTagDefault is the untagged
  // default, same reasoning as kEmbedderDataTypeTagDefault elsewhere.
  const lo_fn_desc_t* desc = reinterpret_cast<const lo_fn_desc_t*>(
    Local<External>::Cast(args.Data())->Value(kExternalPointerTypeTagDefault));

  if (desc->nparams > kMaxArgs) {
    isolate->ThrowError("lo_abi: too many parameters for generic dispatch");
    return;
  }

  uint64_t argv[kMaxArgs] = {0};
  // Keeps any LO_STRING-extracted UTF-8 buffers alive until after the
  // native call below. String::Utf8Value is neither copyable nor movable,
  // so it can't live in a std::vector (fails Cpp17MoveInsertable) -- a
  // fixed array of unique_ptr<Utf8Value> sidesteps that; only the
  // unique_ptr itself needs to be movable/default-constructible, not the
  // Utf8Value it owns.
  std::unique_ptr<String::Utf8Value> strings[kMaxArgs];

  for (uint8_t i = 0; i < desc->nparams; i++) {
    switch (desc->params[i]) {
      case LO_STRING: {
        strings[i] = std::make_unique<String::Utf8Value>(isolate, args[i]);
        argv[i] = reinterpret_cast<uint64_t>(**strings[i]);
        break;
      }
      case LO_POINTER:
      case LO_BUFFER:
        argv[i] = (uint64_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case LO_BOOL:
      case LO_I8: case LO_U8: case LO_I16: case LO_U16:
      case LO_I32: case LO_U32:
        argv[i] = (uint64_t)(int64_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case LO_I64: case LO_U64: case LO_ISIZE: case LO_USIZE:
        argv[i] = (uint64_t)Local<BigInt>::Cast(args[i])->Int64Value();
        break;
      default:
        isolate->ThrowError("lo_abi: unsupported argument type in generic dispatch");
        return;
    }
  }

  // Dispatch through a canonical wide-integer function pointer type sized
  // to the descriptor's arity. Relies on x64 SysV/ARM64 AAPCS64 both
  // passing narrower integers/pointers in the low bits of the same
  // argument registers a 64-bit value would occupy -- calling through a
  // function pointer typed differently than desc->fn's real declaration is
  // technically UB by the C++ standard, but this is the same risk
  // tolerance lib/asm/*'s hand-rolled JIT trampolines already take
  // (raw machine code assuming exact ABI register conventions). The
  // by-the-book alternative (libffi's ffi_prep_cif/ffi_call) isn't
  // currently linked into this build -- see doc/WORK.E.1.md.
  uint64_t rv = 0;
  switch (desc->nparams) {
    case 0: { typedef uint64_t (*F)(); rv = ((F)desc->fn)(); break; }
    case 1: { typedef uint64_t (*F)(uint64_t); rv = ((F)desc->fn)(argv[0]); break; }
    case 2: { typedef uint64_t (*F)(uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1]); break; }
    case 3: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2]); break; }
    case 4: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3]); break; }
    case 5: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4]); break; }
    case 6: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5]); break; }
  }

  switch (desc->result) {
    case LO_VOID:
      return;
    case LO_BOOL:
      args.GetReturnValue().Set((bool)rv);
      return;
    case LO_I8: case LO_I16: case LO_I32:
      args.GetReturnValue().Set((int32_t)rv);
      return;
    case LO_U8: case LO_U16: case LO_U32:
      args.GetReturnValue().Set((uint32_t)rv);
      return;
    case LO_POINTER: case LO_BUFFER:
      // matches the existing convention (e.g. epoll.cc's *Slow functions):
      // addresses cross into JS as plain numbers.
      args.GetReturnValue().Set((double)rv);
      return;
    case LO_I64: case LO_U64: case LO_ISIZE: case LO_USIZE:
      args.GetReturnValue().Set(BigInt::NewFromUnsigned(isolate, rv));
      return;
    default:
      isolate->ThrowError("lo_abi: unsupported result type in generic dispatch");
      return;
  }
}

} // namespace

extern "C" {

void lo_engine_throw(lo_engine_t* engine, const char* message) {
  Isolate* isolate = AsIsolate(engine);
  isolate->ThrowException(Exception::Error(
    String::NewFromUtf8(isolate, message).ToLocalChecked()));
}

int lo_engine_has_exception(lo_engine_t*) {
  // Not exercised by this prototype -- a real implementation would check
  // the active TryCatch/isolate exception state.
  return 0;
}

lo_status_t lo_register_functions(lo_engine_t* engine, lo_exports_t* exports,
    const lo_fn_desc_t* fns, uint32_t count) {
  Isolate* isolate = AsIsolate(engine);
  ExportsImpl* impl = AsExports(exports);

  for (uint32_t i = 0; i < count; i++) {
    const lo_fn_desc_t* desc = &fns[i];
    Local<External> data = External::New(isolate, (void*)desc, kExternalPointerTypeTagDefault);
    Local<FunctionTemplate> ft = FunctionTemplate::New(isolate, GenericDispatch, data);
    impl->tmpl->Set(isolate, desc->name, ft);
  }
  return LO_OK;
}

} // extern "C"

// ---------------------------------------------------------------------
// Registration shim: adapts today's `_register_<name>() -> void*` /
// InitializerCallback convention (see lo.h, main.h) to the portable
// `lo_register_<name>(engine, realm, exports, abi_version)` entry point a
// lo_abi.h-targeted binding actually exports.
//
// Generalized as a macro (not hand-written per binding) once a second
// binding target (foo_abi) showed the encode_abi-only prototype's Init
// body was pure boilerplate -- every ABI-targeted binding needs the exact
// same three lines (build an ExportsImpl, call lo_register_<name>, SET_MODULE
// the result), just with <name> substituted throughout. One
// LO_ABI_V8_BINDING(name) line per binding still needs to live here --
// lib/gen.js codegen integration to emit this automatically is separate,
// later work (doc/WORK.E.1.md's non-goals).
// ---------------------------------------------------------------------

#define LO_ABI_V8_BINDING(name) \
  extern "C" lo_status_t lo_register_##name( \
    lo_engine_t*, lo_realm_t*, lo_exports_t*, uint32_t); \
  namespace lo { namespace name##_abi_shim { \
    void Init(Isolate* isolate, Local<ObjectTemplate> target) { \
      ExportsImpl impl{isolate, ObjectTemplate::New(isolate)}; \
      lo_status_t rc = lo_register_##name( \
        reinterpret_cast<lo_engine_t*>(isolate), \
        nullptr, /* realm -- unused by this binding */ \
        reinterpret_cast<lo_exports_t*>(&impl), \
        lo_abi_version()); \
      if (rc != LO_OK) return; \
      SET_MODULE(isolate, target, #name, impl.tmpl); \
    } \
  } } \
  extern "C" { \
    DLL_PUBLIC void* _register_##name() { \
      return (void*)lo::name##_abi_shim::Init; \
    } \
  }

LO_ABI_V8_BINDING(foo_abi)
