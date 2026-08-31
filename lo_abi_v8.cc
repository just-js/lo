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
#include <utility>

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
constexpr int kMaxArgs = 6;

// Bump if a real binding ever needs more than this many total registered
// ABI functions across the process -- each slot costs one entry in each
// of the three dispatch tables below, so this is a compile-time/binary-
// size tradeoff, not a design limit.
constexpr int kMaxSlots = 256;

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
    case LO_POINTER: case LO_BUFFER: case LO_ISIZE: case LO_USIZE:
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

  for (uint8_t i = 0; i < desc->nparams; i++) {
    switch (desc->params[i]) {
      case LO_STRING: {
        String::Utf8Value str(isolate, args[i]);
        strdup_strs[nstrdup] = strdup(*str);
        argv[i] = reinterpret_cast<uint64_t>(strdup_strs[nstrdup]);
        nstrdup++;
        break;
      }
      case LO_POINTER:
      case LO_BUFFER:
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
        isolate->ThrowError("lo_abi: unsupported argument type in generic dispatch");
        return;
    }
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
// V8 Fast API Call smoke test (WORK.E.1.md's deliberately-deferred "Open
// question"). Scoped as narrow as possible on purpose -- only the
// 0-arg/LO_VOID-result shape (exactly noop()'s shape) -- to prove the
// mechanism works at all before generalizing to every arity/register
// class. Not new invention: lib/core/api.js's bind_fastcallSlow already
// builds CTypeInfo/CFunctionInfo/CFunction dynamically from a runtime
// type-tag array for dlopen'd FFI calls; this is the same trick applied
// to lo_fn_desc_t, at registration time, once per binding rather than
// once per dlopen'd call.
//
// The fast callback still needs to know which descriptor it's for --
// Fast API Calls have no Data()-equivalent at all, so this reuses the
// exact same per-slot template mechanism as the slow tiers above rather
// than inventing a second way to smuggle state in.
template<int Slot>
void DispatchNoArgsFast(void* receiver) {
  const lo_fn_desc_t* desc = g_descriptors[Slot];
  typedef void (*F)();
  ((F)desc->fn)();
}

// One shared CTypeInfo/CFunctionInfo for every slot -- valid because
// this smoke test only ever targets one shape (0 real params + the
// receiver V8 always prepends, void return), so every slot's fast
// signature is identical; only which compiled DispatchNoArgsFast<Slot>
// a given CFunction points at differs per slot.
CTypeInfo kNoArgsFastCArgs[1] = { CTypeInfo(CTypeInfo::Type::kV8Value) };
CTypeInfo kVoidFastReturn = CTypeInfo(CTypeInfo::Type::kVoid);
CFunctionInfo kNoArgsFastInfo(kVoidFastReturn, 1, kNoArgsFastCArgs);

template<int... Is>
std::array<CFunction, sizeof...(Is)> MakeNoArgsFastTable(std::integer_sequence<int, Is...>) {
  return { CFunction((const void*)&DispatchNoArgsFast<Is>, &kNoArgsFastInfo)... };
}
// Not constexpr -- CFunction's constructor isn't usable in a constant
// expression the way a plain function pointer is -- but this still only
// runs once, at static-init time, never per call.
const std::array<CFunction, kMaxSlots> kNoArgsFastTable = MakeNoArgsFastTable(std::make_integer_sequence<int, kMaxSlots>{});

// ---------------------------------------------------------------------
// Shim for V8's not-yet-landed CFunctionInfo::HasReceiver (this repo's
// own patches/15.3-cfunctioninfo-has-receiver-kno.patch -- pushed, not
// yet built/linked here). Lets the real, receiver-free business logic
// below get written, compiled, and correctness-tested *today* against
// the current, unpatched libv8_monolith.a, ready to drop the adapter
// with a one-line change once the patched build lands -- not a rewrite.
//
// Real constraint this respects, not glossed over: today's compiled V8
// unconditionally treats arg_info[0] as the receiver slot and pushes a
// real live JS receiver value into that register regardless of what we
// claim -- so this never lies to the real CFunctionInfo/CFunction about
// the shape (that would be genuine type confusion at the ABI boundary,
// not just a missed perf win). Flip this to 1 once the patched V8 is
// actually linked; every block below says exactly what to delete.
#define LO_V8_HAS_RECEIVER_KNO 0

// Tier 1 proof-of-concept: a single concrete shape (1 arg, both int32),
// not the full arity/register-class generalization scoped separately --
// proves the "direct-install, no wrapper needed" design and the
// HasReceiver shim pattern before generalizing. "Core" business logic:
// what every future int32-shaped fast call should look like once the
// patch lands -- no receiver parameter, argument positions line up
// exactly with desc->fn's own real C signature.
template<int Slot>
int32_t DispatchInt32Fast_Core(int32_t a0) {
  const lo_fn_desc_t* desc = g_descriptors[Slot];
  typedef int32_t (*F)(int32_t);
  return ((F)desc->fn)(a0);
}

#if LO_V8_HAS_RECEIVER_KNO
// Once LO_V8_HAS_RECEIVER_KNO is 1: DispatchInt32Fast_Core<Slot> is
// installed directly as the CFunction target below -- delete this
// #else branch (the adapter and its args/table) entirely, nothing else
// changes.
#else
// Adapter: today's real V8 still requires -- and will actually place a
// live JS receiver value into -- a leading parameter. Accept it, ignore
// it, forward to the real logic above. Safe and correct under today's
// real, unpatched ABI; costs exactly the register-shift the patch
// exists to remove.
template<int Slot>
int32_t DispatchInt32Fast(void* /* receiver, ignored -- see LO_V8_HAS_RECEIVER_KNO above */, int32_t a0) {
  return DispatchInt32Fast_Core<Slot>(a0);
}
#endif

#if LO_V8_HAS_RECEIVER_KNO
CTypeInfo kInt32FastCArgs[1] = { CTypeInfo(CTypeInfo::Type::kInt32) };
#else
CTypeInfo kInt32FastCArgs[2] = { CTypeInfo(CTypeInfo::Type::kV8Value),
                                CTypeInfo(CTypeInfo::Type::kInt32) };
#endif
CTypeInfo kInt32FastReturn = CTypeInfo(CTypeInfo::Type::kInt32);
#if LO_V8_HAS_RECEIVER_KNO
CFunctionInfo kInt32FastInfo(kInt32FastReturn, 1, kInt32FastCArgs,
  CFunctionInfo::Int64Representation::kNumber, CFunctionInfo::HasReceiver::kNo);
#else
CFunctionInfo kInt32FastInfo(kInt32FastReturn, 2, kInt32FastCArgs);
#endif

template<int... Is>
std::array<CFunction, sizeof...(Is)> MakeInt32FastTable(std::integer_sequence<int, Is...>) {
#if LO_V8_HAS_RECEIVER_KNO
  return { CFunction((const void*)&DispatchInt32Fast_Core<Is>, &kInt32FastInfo)... };
#else
  return { CFunction((const void*)&DispatchInt32Fast<Is>, &kInt32FastInfo)... };
#endif
}
const std::array<CFunction, kMaxSlots> kInt32FastTable = MakeInt32FastTable(std::make_integer_sequence<int, kMaxSlots>{});

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
    if (desc->nparams == 0 && desc->result == LO_VOID) {
      // Fast API Call smoke test -- see its comment above for scope.
      // The slow callback (cb, already built above) still gets passed
      // through as the required fallback -- V8 only takes the fast path
      // once Turbofan/Maglev has actually optimized the call site.
      ft = FunctionTemplate::New(isolate, cb, Local<Value>(), Local<Signature>(),
        0, ConstructorBehavior::kThrow, SideEffectType::kHasNoSideEffect,
        const_cast<CFunction*>(&kNoArgsFastTable[slot]));
    } else if (desc->nparams == 1 && desc->params[0] == LO_I32 && desc->result == LO_I32) {
      // Tier 1 fast-call proof of concept -- see the HasReceiver shim
      // comment above. Same fallback contract as the 0-arg case.
      ft = FunctionTemplate::New(isolate, cb, Local<Value>(), Local<Signature>(),
        0, ConstructorBehavior::kThrow, SideEffectType::kHasNoSideEffect,
        const_cast<CFunction*>(&kInt32FastTable[slot]));
    } else {
      ft = FunctionTemplate::New(isolate, cb);
    }
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
