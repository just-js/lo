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
static lo_fn_desc_t tt;


void GenericDispatch(const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = nullptr;
//  HandleScope scope(isolate);
  // Descriptor travels via an internal field on an Object in Data(), not
  // v8::External -- benchmarked (bench-abi.js, foo vs foo_abi with
  // lib/foo's nofast:true for a fair slow-path-only comparison): a 0-arg
  // noop() was ~8ns generated vs ~20ns through External-based
  // GenericDispatch. External::New/::Value are real out-of-line V8_EXPORT
  // calls into libv8_monolith.a (v8-external.h); GetAlignedPointerFromInternalField
  // is V8_INLINE (v8-object.h) -- a direct field read, no library call.
  // Matches lib/core/api.js's own SlowCallback/struct fastcall precedent,
  // which already uses internal fields for exactly this. Confirmed this
  // build has v8_enable_sandbox=false (args.linux.x64.gn) so this isn't
  // about the external-pointer-table indirection, just which of V8's two
  // Data()-smuggling mechanisms happens to be inlined.
#if LO_V8_INTERNAL_FIELD_TAG
//  const lo_fn_desc_t* desc = reinterpret_cast<const lo_fn_desc_t*>(
//    args.Data().As<Object>()->GetAlignedPointerFromInternalField(1, v8::kEmbedderDataTypeTagDefault));
#else
//  const lo_fn_desc_t* desc = reinterpret_cast<const lo_fn_desc_t*>(
//    args.Data().As<Object>()->GetAlignedPointerFromInternalField(1));
#endif

  const lo_fn_desc_t* desc = &tt;

  // strdup'd UTF-8 buffers, freed after the native call below -- bounded
  // by nstrdup (how many LO_STRING args this call actually had), not
  // kMaxArgs. Profiled (perf record -e cpu-clock -g --call-graph=dwarf,
  // see doc/PROFILING.md): a fixed std::unique_ptr<String::Utf8Value>
  // strings[kMaxArgs] here previously cost ~14-16% of GenericDispatch's
  // own self time on a 0-arg call -- six unconditional destructor checks
  // every call regardless of nparams, since the array's size is fixed at
  // compile time, not desc->nparams. Matches lib/core/api.js's
  // SlowCallback (its temp_strs[]/s pattern) exactly instead.

  uint64_t rv = 0;
  if (desc->nparams > 0) {
    if (desc->nparams > kMaxArgs) {
      if (isolate == nullptr) isolate = args.GetIsolate();
      isolate->ThrowError("lo_abi: too many parameters for generic dispatch");
      return;
    }
    uint64_t argv[kMaxArgs] = {0};
    int nstrdup = 0;
    char* strdup_strs[kMaxArgs];

    for (uint8_t i = 0; i < desc->nparams; i++) {
      switch (desc->params[i]) {
        case LO_STRING: {
          if (isolate == nullptr) isolate = args.GetIsolate();
          String::Utf8Value str(isolate, args[i]);
          strdup_strs[nstrdup] = strdup(*str);
          argv[i] = reinterpret_cast<uint64_t>(strdup_strs[nstrdup]);
          nstrdup++;
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
    switch (desc->nparams) {
      case 0: { typedef uint64_t (*F)(); rv = ((F)desc->fn)(); break; }
      case 1: { typedef uint64_t (*F)(uint64_t); rv = ((F)desc->fn)(argv[0]); break; }
      case 2: { typedef uint64_t (*F)(uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1]); break; }
      case 3: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2]); break; }
      case 4: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3]); break; }
      case 5: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4]); break; }
      case 6: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5]); break; }
    }
    for (int i = 0; i < nstrdup; i++) free(strdup_strs[i]);
  } else {
    typedef uint64_t (*F)(); rv = ((F)desc->fn)();
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
      if (isolate == nullptr) isolate = args.GetIsolate();
      args.GetReturnValue().Set(BigInt::NewFromUnsigned(isolate, rv));
      return;
    default:
      if (isolate == nullptr) isolate = args.GetIsolate();
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
  Local<Context> context = isolate->GetCurrentContext();
  ExportsImpl* impl = AsExports(exports);

  for (uint32_t i = 0; i < count; i++) {
    const lo_fn_desc_t* desc = &fns[i];
    memcpy(&tt, desc, sizeof(lo_fn_desc_t));
    // Same internal-field-on-an-Object mechanism as lib/core/api.js's
    // bind_fastcallSlow (index 1, count 2 -- matching that existing
    // convention rather than inventing a new one) instead of v8::External
    // -- see GenericDispatch's comment for why.
    Local<ObjectTemplate> data_tpl = ObjectTemplate::New(isolate);
    data_tpl->SetInternalFieldCount(2);
    Local<Object> data = data_tpl->NewInstance(context).ToLocalChecked();
#if LO_V8_INTERNAL_FIELD_TAG
//    data->SetAlignedPointerInInternalField(1, (void*)desc, v8::kEmbedderDataTypeTagDefault);
#else
//    data->SetAlignedPointerInInternalField(1, (void*)desc);
#endif
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
