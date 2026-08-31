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

#include <array>
#include <atomic>
#include <optional>
#include <utility>
#include <vector>

using namespace v8;

namespace {

// The concrete definition behind the opaque lo_exports_t declared in
// lo_abi.h — "an exports object under construction," backed by a real
// V8 ObjectTemplate for this engine. Lives only as long as one
// registration call (see GenericInit below) — never persisted past it.
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

// Three-tier dispatch, chosen per descriptor at *registration* time, not
// branched on per call. Two real, measured costs drove this (see
// doc/PROFILING.md):
//
// 1. args.Data() itself -- via v8::External or an internal field, doesn't
//    matter which -- costs ~9ns/call (V8's own GetFunctionTemplateData
//    mints a fresh Handle every call). Avoided entirely below: each
//    registered function gets a fixed "slot" at registration time, and a
//    compile-time-generated table of function-pointer-per-slot dispatch
//    bodies (the index_sequence machinery further down) lets
//    FunctionTemplate::New install a distinct compiled function per slot
//    -- which slot a call belongs to is baked into *which compiled
//    function got installed*, not looked up via any V8 mechanism at call
//    time.
// 2. A single monolithic dispatcher makes even a 0-arg call pay for the
//    worst case's register pressure: `objdump`'ing the compiled code
//    (doc/PROFILING.md's "reading generated code directly" section)
//    showed a single do-everything dispatcher unconditionally pushing 6
//    callee-saved registers and reserving a 136-byte stack frame on
//    *every* call, because the compiler sizes a function's prologue for
//    its whole body (the multi-arg/string-handling branch needs several
//    live registers and local arrays) -- not the branch actually taken.
//    Splitting by shape means the 0-arg tier's compiled body has nothing
//    forcing that register pressure in the first place.
//
// Known limitations of this first pass (fine for lib/foo_abi, not a
// complete implementation): no LO_F32/LO_F64 (float register class needs
// separate handling on both x64 SysV and ARM64 AAPCS64 -- real work, not
// needed by any binding yet), max 6 params, LO_STRING extraction always
// copies (matches today's String::Utf8Value-based Slow paths -- no attempt
// at V8's zero-copy FastOneByteString path here, see doc/WORK.E.1.md's
// "Open question" section).
// 10 covers the real max across every binding's api.js today
// (lib/pico's on_headers_complete callback registration) -- surveyed
// directly (grep every generated *_params[] array), not guessed. This
// was silently too small at 6: lo_register_functions below rejects any
// function past kMaxArgs with LO_INVALID_ARG, and the abi target's
// LO_REGISTER(name) body bails out on the *first* such rejection before
// SET_MODULE ever runs -- so a binding with just one >6-arg function
// (libssl, sqlite, pico) registered *zero* exports at all, silently:
// it compiled and linked fine, `lo.library(name)` just returned an
// empty object. Found by actually calling lo.library() on every
// abi-target binding linked into a real runtime/lo build, not by
// reading the code -- exactly the "compiles and links isn't enough"
// lesson from the registration-shim bug (see lo_abi.h's comment on
// lo_abi_v8_register_binding).
constexpr int kMaxArgs = 10;

// Bump if a real binding ever needs more than this many total registered
// ABI functions across the process -- each slot costs one entry in each
// of the three dispatch tables below, so this is a compile-time/binary-
// size tradeoff, not a design limit. Genuinely process-wide, not per-
// binding, now that lo_abi_v8.cc compiles once into the runtime itself
// rather than once per binding's own .so (see lib/build.js's
// compile_bindings) -- every ABI-targeted binding loaded in one process
// shares this same pool. 256 was already tight against just lib/core_abi
// alone (~66 functions); 1024 leaves real headroom for several bindings
// loaded together.
constexpr int kMaxSlots = 1024;

const lo_fn_desc_t* g_descriptors[kMaxSlots] = {};
// Registration happens once per isolate setup, but lo can run one
// isolate per OS thread (lo_abi.h's own doc comment on lo_engine_t) --
// std::atomic here costs nothing on the call hot path (only touched at
// registration) and avoids a real race if two isolates ever register
// concurrently, since g_descriptors/g_next_slot are process-wide, not
// per-isolate.
std::atomic<int> g_next_slot{0};

// Recovers the real return value's mathematical bit pattern from a call
// made through the canonical-uint64_t-return dispatch trick (the
// nparams-switches below), before it reaches SetResult's own narrowing
// casts. Necessary because a callee that actually returns a narrower
// type (bool/i8/u8/i16/u16) only writes the low bits of its return
// register -- the ABI leaves the rest unspecified, not necessarily
// zero. i32/u32 happen to already come back correctly on x86-64 (32-bit
// register writes there hardware-zero-extend into the full 64-bit
// register) -- confirmed by testing add1() before this fix existed --
// but that's an x86-64 coincidence, not something to rely on generally
// (this project targets ARM64 too); handled uniformly here regardless.
inline uint64_t NarrowResult(lo_type_t result, uint64_t rv) {
  switch (result) {
    case LO_I8: return (uint64_t)(int64_t)(int8_t)(uint8_t)rv;
    case LO_U8: case LO_BOOL: return (uint8_t)rv;
    case LO_I16: return (uint64_t)(int64_t)(int16_t)(uint16_t)rv;
    case LO_U16: return (uint16_t)rv;
    case LO_I32: return (uint64_t)(int64_t)(int32_t)(uint32_t)rv;
    case LO_U32: return (uint32_t)rv;
    default: return rv;
  }
}

// Shared by all three tiers -- setting the JS return value from the raw
// uint64_t every native call produces. Isolate is only fetched (by the
// two branches that need it) lazily, not by every caller up front.
inline void SetResult(const FunctionCallbackInfo<Value>& args, lo_type_t result, uint64_t rv) {
  switch (result) {
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
    case LO_POINTER: case LO_BUFFER: case LO_U32ARRAY: case LO_ISIZE: case LO_USIZE:
      // matches the existing convention (e.g. epoll.cc's *Slow functions):
      // addresses/sizes cross into JS as plain numbers, precise enough for
      // any pointer-sized value on architectures actually targeted here.
      // Only LO_I64/LO_U64 -- genuine 64-bit values that could realistically
      // need the full range -- use BigInt; nothing else does (explicit
      // decision, see WORK.md).
      args.GetReturnValue().Set((double)rv);
      return;
    case LO_I64: case LO_U64:
      args.GetReturnValue().Set(BigInt::NewFromUnsigned(args.GetIsolate(), rv));
      return;
    default:
      args.GetIsolate()->ThrowError("lo_abi: unsupported result type in generic dispatch");
      return;
  }
}

// Tier 0: zero-argument functions. No argv array, no marshaling loop, no
// locals to speak of -- as close to a hand-generated wrapper's own
// compiled shape as this generic mechanism can get.
template<int Slot>
void DispatchNoArgs(const FunctionCallbackInfo<Value>& args) {
  const lo_fn_desc_t* desc = g_descriptors[Slot];
  typedef uint64_t (*F)();
  uint64_t rv = ((F)desc->fn)();
  SetResult(args, desc->result, NarrowResult(desc->result, rv));
}

// Tier 1: 1-6 scalar/pointer arguments, no strings. Needs argv[] and the
// marshaling loop, but deliberately has no LO_STRING case at all -- kept
// out of this tier's compiled body entirely so functions that never take
// a string don't pay for the extra register pressure/stack-protector
// trigger that strdup/free-based string handling brings with it (see
// tier 2). desc->nparams is validated against kMaxArgs once, at
// registration (lo_register_functions below) -- not re-checked per call.
template<int Slot>
void DispatchPrimitiveArgs(const FunctionCallbackInfo<Value>& args) {
  const lo_fn_desc_t* desc = g_descriptors[Slot];
  uint64_t argv[kMaxArgs] = {0};

  for (uint8_t i = 0; i < desc->nparams; i++) {
    switch (desc->params[i]) {
      case LO_POINTER:
      case LO_BUFFER:
      case LO_U32ARRAY:
      case LO_ISIZE:
      case LO_USIZE:
        argv[i] = (uint64_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case LO_BOOL:
      case LO_I8: case LO_U8: case LO_I16: case LO_U16:
      case LO_I32: case LO_U32:
        argv[i] = (uint64_t)(int64_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case LO_I64: case LO_U64:
        argv[i] = (uint64_t)Local<BigInt>::Cast(args[i])->Int64Value();
        break;
      default:
        args.GetIsolate()->ThrowError("lo_abi: unsupported argument type in generic dispatch");
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
    case 1: { typedef uint64_t (*F)(uint64_t); rv = ((F)desc->fn)(argv[0]); break; }
    case 2: { typedef uint64_t (*F)(uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1]); break; }
    case 3: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2]); break; }
    case 4: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3]); break; }
    case 5: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4]); break; }
    case 6: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5]); break; }
    case 7: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5], argv[6]); break; }
    case 8: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5], argv[6], argv[7]); break; }
    case 9: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5], argv[6], argv[7], argv[8]); break; }
    case 10: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5], argv[6], argv[7], argv[8], argv[9]); break; }
  }
  SetResult(args, desc->result, NarrowResult(desc->result, rv));
}

// Tier 2: has at least one LO_STRING argument -- the full machinery
// (String::Utf8Value extraction, strdup'd buffers freed after the call,
// bounded by nstrdup -- how many string args this call actually had, not
// kMaxArgs -- matching lib/core/api.js's SlowCallback temp_strs[]/s
// pattern). Only functions that actually take a string pay for this
// tier's larger register footprint.
template<int Slot>
void DispatchGeneral(const FunctionCallbackInfo<Value>& args) {
  const lo_fn_desc_t* desc = g_descriptors[Slot];
  Isolate* isolate = args.GetIsolate();
  uint64_t argv[kMaxArgs] = {0};
  char* strdup_strs[kMaxArgs];
  int nstrdup = 0;
  uint8_t js_arg = 0; // separate counter: overridden positions (below)
                      // consume no JS argument at all, so position i in
                      // desc->params[] and args[] only stay in lockstep
                      // until the first override -- trailing-only, by
                      // construction (lib/gen.js enforces this).

  for (uint8_t i = 0; i < desc->nparams; i++) {
    if (desc->overrides && desc->overrides[i] != LO_NO_OVERRIDE) {
      // Computed, not caller-supplied -- see lo_abi.h's own comment on
      // `overrides`.
      if (desc->overrides[i] == LO_OVERRIDE_LITERAL_ZERO) {
        argv[i] = 0;
      } else {
        // A trailing length-of-a-preceding-string -- the referenced
        // position's strdup'd pointer is already sitting in argv[]
        // from an earlier iteration of this same loop.
        const char* target = reinterpret_cast<const char*>(argv[desc->overrides[i]]);
        argv[i] = (uint64_t)strlen(target);
      }
      continue;
    }
    switch (desc->params[i]) {
      case LO_STRING: {
        String::Utf8Value str(isolate, args[js_arg]);
        strdup_strs[nstrdup] = strdup(*str);
        argv[i] = reinterpret_cast<uint64_t>(strdup_strs[nstrdup]);
        nstrdup++;
        break;
      }
      case LO_POINTER:
      case LO_BUFFER:
      case LO_U32ARRAY:
      case LO_ISIZE:
      case LO_USIZE:
        argv[i] = (uint64_t)Local<Integer>::Cast(args[js_arg])->Value();
        break;
      case LO_BOOL:
      case LO_I8: case LO_U8: case LO_I16: case LO_U16:
      case LO_I32: case LO_U32:
        argv[i] = (uint64_t)(int64_t)Local<Integer>::Cast(args[js_arg])->Value();
        break;
      case LO_I64: case LO_U64:
        argv[i] = (uint64_t)Local<BigInt>::Cast(args[js_arg])->Int64Value();
        break;
      default:
        isolate->ThrowError("lo_abi: unsupported argument type in generic dispatch");
        return;
    }
    js_arg++;
  }

  uint64_t rv = 0;
  switch (desc->nparams) {
    case 0: { typedef uint64_t (*F)(); rv = ((F)desc->fn)(); break; }
    case 1: { typedef uint64_t (*F)(uint64_t); rv = ((F)desc->fn)(argv[0]); break; }
    case 2: { typedef uint64_t (*F)(uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1]); break; }
    case 3: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2]); break; }
    case 4: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3]); break; }
    case 5: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4]); break; }
    case 6: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5]); break; }
    case 7: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5], argv[6]); break; }
    case 8: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5], argv[6], argv[7]); break; }
    case 9: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5], argv[6], argv[7], argv[8]); break; }
    case 10: { typedef uint64_t (*F)(uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t, uint64_t); rv = ((F)desc->fn)(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5], argv[6], argv[7], argv[8], argv[9]); break; }
  }
  for (int i = 0; i < nstrdup; i++) free(strdup_strs[i]);
  SetResult(args, desc->result, NarrowResult(desc->result, rv));
}

// Builds a kMaxSlots-entry table of &Dispatch<0>, &Dispatch<1>, ... at
// compile time -- one table per tier, so lo_register_functions just
// indexes by slot rather than generating anything itself. Three near-
// identical builders, not one generic over Dispatch -- a template
// template parameter can only bind a class template, never a function
// template like DispatchNoArgs/DispatchPrimitiveArgs/DispatchGeneral.
template<int... Is>
constexpr std::array<FunctionCallback, sizeof...(Is)> MakeNoArgsTable(std::integer_sequence<int, Is...>) {
  return { &DispatchNoArgs<Is>... };
}
template<int... Is>
constexpr std::array<FunctionCallback, sizeof...(Is)> MakePrimitiveTable(std::integer_sequence<int, Is...>) {
  return { &DispatchPrimitiveArgs<Is>... };
}
template<int... Is>
constexpr std::array<FunctionCallback, sizeof...(Is)> MakeGeneralTable(std::integer_sequence<int, Is...>) {
  return { &DispatchGeneral<Is>... };
}

constexpr auto kNoArgsTable = MakeNoArgsTable(std::make_integer_sequence<int, kMaxSlots>{});
constexpr auto kPrimitiveTable = MakePrimitiveTable(std::make_integer_sequence<int, kMaxSlots>{});
constexpr auto kGeneralTable = MakeGeneralTable(std::make_integer_sequence<int, kMaxSlots>{});

// ---------------------------------------------------------------------
// V8 Fast API Calls, generalized past the original 0-arg/int32-arg
// proofs of concept (doc/WORK.E.1.md's "Update, third follow-on
// session"): any shape built entirely from integer/bool/pointer-class
// types (no LO_STRING, no LO_F32/LO_F64, no LO_I64/LO_U64 -- those stay
// slow-only; the first two need real float register-class handling, the
// last two need Int64Representation::kBigInt threaded through, neither
// done yet), up to kMaxArgs params.
//
// Unlike the slow tiers above, this can't be one shared per-slot
// template: V8 calls the Fast API entry point directly, with real native
// argument types in real ABI registers matching CFunctionInfo's
// declaration exactly -- there is no generic "cast everything to
// uint64_t" trick available at this boundary the way there is for the
// slow path's FunctionCallbackInfo-based args. So the wrapper itself
// (desc->fast_fn) has to be a real, concretely-typed function -- one per
// distinct shape, codegen'd directly into the binding's own generated
// .cc by lib/gen.js's bindingsAbi() (see its getAbiFastCType/
// genAbiFastWrapper), not built here. What *is* generic here, and does
// live in this shared file: mapping lo_type_t to the right
// CTypeInfo::Type/CFunctionInfo, and deciding per descriptor whether its
// (already-generated, already-typed) fast_fn is actually usable.
//
// No receiver parameter on any of these -- this repo's own V8 patch
// (patches/15.3-cfunctioninfo-has-receiver-kno.patch, upstreaming
// CFunctionInfo::HasReceiver::kNo) removed the need for one, so a fast
// wrapper's parameter list lines up exactly with desc->fn's own real C
// signature (same idea `bind_fastcallSlow` already applies to dlopen'd
// FFI calls, just resolved by codegen instead of at call-bind time).
inline bool ToFastCType(lo_type_t t, CTypeInfo::Type* out) {
  switch (t) {
    case LO_I8: case LO_I16: case LO_I32: *out = CTypeInfo::Type::kInt32; return true;
    case LO_U8: case LO_U16: case LO_U32: *out = CTypeInfo::Type::kUint32; return true;
    case LO_BOOL: *out = CTypeInfo::Type::kBool; return true;
    case LO_ISIZE: *out = CTypeInfo::Type::kInt64; return true;
    case LO_USIZE: case LO_POINTER: case LO_BUFFER: case LO_U32ARRAY: *out = CTypeInfo::Type::kUint64; return true;
    case LO_VOID: *out = CTypeInfo::Type::kVoid; return true;
    default: return false; // LO_STRING/LO_F32/LO_F64/LO_I64/LO_U64/LO_FUNCTION
  }
}

// Per-slot storage for the dynamically-built CTypeInfo/CFunctionInfo/
// CFunction a fast-eligible descriptor needs -- same lifetime as
// g_descriptors (process lifetime, built once at registration), so
// indexed by slot rather than heap allocation per call the way
// bind_fastcallSlow does per dlopen'd bind (that path binds once per FFI
// call site set up at runtime; this one binds once per statically-known
// function). g_fast_cargs is a vector, not a fixed CTypeInfo[kMaxArgs]
// array, because CTypeInfo has no default constructor -- an empty
// vector needs none either, only push_back's move/copy, which it has;
// .data() stays valid afterward since nothing here ever grows a slot's
// vector again post-registration.
std::vector<CTypeInfo> g_fast_cargs[kMaxSlots];
std::optional<CFunctionInfo> g_fast_info[kMaxSlots];
std::optional<CFunction> g_fast_cfunc[kMaxSlots];

// Builds slot's fast CFunction from desc, if desc->fast_fn is set and
// every param/result type is fast-callable. Returns it, or nullptr if
// this descriptor has no usable fast path -- checked here rather than
// trusted from codegen, so a hand-written or buggy lo_fn_desc_t can
// never cause a real type-confused Fast API Call, only silently fall
// back to the always-correct slow path.
CFunction* BuildFastCFunction(int slot, const lo_fn_desc_t* desc) {
  if (!desc->fast_fn) return nullptr;
  CTypeInfo::Type return_type;
  if (!ToFastCType(desc->result, &return_type)) return nullptr;
  for (uint8_t i = 0; i < desc->nparams; i++) {
    CTypeInfo::Type t;
    if (!ToFastCType(desc->params[i], &t)) return nullptr;
    g_fast_cargs[slot].push_back(CTypeInfo(t));
  }
  g_fast_info[slot].emplace(CTypeInfo(return_type), desc->nparams, g_fast_cargs[slot].data(),
    CFunctionInfo::Int64Representation::kNumber, CFunctionInfo::HasReceiver::kNo);
  g_fast_cfunc[slot].emplace(desc->fast_fn, &*g_fast_info[slot]);
  return &*g_fast_cfunc[slot];
}

// ---------------------------------------------------------------------
// Per-binding registration. lo.cc/main.h's existing `_register_<name>()
// -> void*` convention (lo::Library reinterpret_casts the result
// straight to InitializerCallback and calls it with a real Isolate*/
// Local<ObjectTemplate>) has no way to close over extra context -- a
// plain function pointer, not a capturing lambda -- so *some* concrete
// Isolate*/Local<ObjectTemplate>-taking function has to exist per
// binding somewhere.
//
// The first version of this put that function directly in each
// binding's own generated .cc (a small header-based macro,
// LO_ABI_V8_BINDING) -- which genuinely worked, but broke the ABI's own
// point in the process: v8::ObjectTemplate::New and lo::SET_MODULE
// (itself v8::-typed) ended up compiled directly into the binding's own
// object code, a real dependency the whole design exists to avoid (a
// binding relinked against a different engine's backend would need that
// code rewritten too). Caught via `nm -D`/`ldd` showing exactly those
// undefined v8:: symbols in a binding's own .so.
//
// Fixed the same way the call dispatch above already solves "one
// compiled function per runtime-determined slot": GenericInit<Slot>
// below is instantiated kMaxBindings times, entirely within this file,
// and lo_abi_v8_register_binding (extern "C", declared in lo_abi.h) is
// the *only* symbol a binding's generated _register_<name>() ever calls
// -- a fully portable signature (lo_register_fn, const char*) -> void*,
// no v8:: type appears in it or at its call site, so the binding's own
// .cc genuinely never touches v8::, not even indirectly.
constexpr int kMaxBindings = 128;

struct BindingInfo {
  lo_register_fn register_fn;
  const char* name;
};
BindingInfo g_bindings[kMaxBindings];
std::atomic<int> g_next_binding{0};

template<int Slot>
void GenericInit(Isolate* isolate, Local<ObjectTemplate> target) {
  const BindingInfo& info = g_bindings[Slot];
  ExportsImpl impl{isolate, ObjectTemplate::New(isolate)};
  lo_status_t rc = info.register_fn(
    reinterpret_cast<lo_engine_t*>(isolate),
    nullptr, // realm -- unused by this ABI's V8 backend
    reinterpret_cast<lo_exports_t*>(&impl),
    lo_abi_version());
  if (rc != LO_OK) return;
  lo::SET_MODULE(isolate, target, info.name, impl.tmpl);
}

template<int... Is>
constexpr std::array<lo::InitializerCallback, sizeof...(Is)> MakeInitTable(std::integer_sequence<int, Is...>) {
  return { &GenericInit<Is>... };
}
constexpr auto kInitTable = MakeInitTable(std::make_integer_sequence<int, kMaxBindings>{});

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
    if (desc->nparams > kMaxArgs) return LO_INVALID_ARG;

    int slot = g_next_slot.fetch_add(1);
    if (slot >= kMaxSlots) return LO_OUT_OF_MEMORY;
    // fns[] is the binding's own `static const lo_fn_desc_t[]` (see
    // lib/foo_abi/foo_abi.cc) -- static storage duration, so the pointer
    // stays valid for the process lifetime and can be stored directly,
    // no copy needed.
    g_descriptors[slot] = desc;

    bool has_string = false;
    for (uint8_t p = 0; p < desc->nparams; p++) {
      if (desc->params[p] == LO_STRING) { has_string = true; break; }
    }

    FunctionCallback cb;
    if (desc->nparams == 0) cb = kNoArgsTable[slot];
    else if (has_string) cb = kGeneralTable[slot];
    else cb = kPrimitiveTable[slot];

    // No `data` argument at all -- see the tier-0/tier-1/tier-2 comment
    // above for why avoiding Data() entirely is the point of this table.
    Local<FunctionTemplate> ft;
    CFunction* fast = BuildFastCFunction(slot, desc);
    if (fast) {
      // The slow callback (cb, already built above) still gets passed
      // through as the required fallback -- V8 only takes the fast path
      // once Turbofan/Maglev has actually optimized the call site.
      ft = FunctionTemplate::New(isolate, cb, Local<Value>(), Local<Signature>(),
        0, ConstructorBehavior::kThrow, SideEffectType::kHasNoSideEffect, fast);
    } else {
      ft = FunctionTemplate::New(isolate, cb);
    }
    impl->tmpl->Set(isolate, desc->name, ft);
  }
  return LO_OK;
}

// lib/gen.js's constants codegen (initConstant) covers u32/i32/u64/i64 on
// the V8-specific target; lo_abi.h only declares the three below (E.9
// surveyed all 43 real bindings' actual constants -- i32/u64/string cover
// every value seen there once sign/width are folded into the call site,
// same as lo_register_functions's own params[]/result already do for
// function shapes).
lo_status_t lo_exports_set_i32(lo_exports_t* exports, const char* name, int32_t value) {
  ExportsImpl* impl = AsExports(exports);
  impl->tmpl->Set(impl->isolate, name, Integer::New(impl->isolate, value));
  return LO_OK;
}

lo_status_t lo_exports_set_u64(lo_exports_t* exports, const char* name, uint64_t value) {
  ExportsImpl* impl = AsExports(exports);
  impl->tmpl->Set(impl->isolate, name, BigInt::NewFromUnsigned(impl->isolate, value));
  return LO_OK;
}

lo_status_t lo_exports_set_string(lo_exports_t* exports, const char* name, const char* value) {
  ExportsImpl* impl = AsExports(exports);
  impl->tmpl->Set(impl->isolate, name,
    String::NewFromUtf8(impl->isolate, value).ToLocalChecked());
  return LO_OK;
}

// The only symbol a binding's own generated _register_<name>() calls
// (see lib/gen.js's bindingsAbi()) -- see the "Per-binding registration"
// comment above for why this exists and what it replaced. Fully
// portable signature: no v8:: type appears here or at any binding's own
// call site, only in this file's own GenericInit<Slot>/kInitTable.
void* lo_abi_v8_register_binding(lo_register_fn fn, const char* name) {
  int slot = g_next_binding.fetch_add(1);
  if (slot >= kMaxBindings) return nullptr;
  g_bindings[slot] = { fn, name };
  return (void*)kInitTable[slot];
}

} // extern "C"
