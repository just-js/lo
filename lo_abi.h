// lo_abi.h — sketch of a portable, engine-neutral C ABI for `lo`.
//
// NOT COMPREHENSIVE. This is a first pass to answer "what would this look
// like" (see doc/WORK.md WORK.A.1 / WORK.E.1) — enough of each mechanism to
// judge the shape, not a full port of every `lo.*` JS entry or every
// accessor. Extension points are marked "... more of these" rather than
// enumerated.
//
// Resolves WORK.A.1 / WORK.E.1 (doc/ABI.md "Option 1 vs Option 2"): this
// commits to Option 1 — a generic function descriptor plus one shared
// dispatch mechanism, rather than per-function codegen'd wrappers. That
// choice isn't speculative here: `lib/core/api.js`'s existing
// `struct fastcall` (consumed by `lib/ffi.js`'s `bind()`/`compile_fastcall`
// for dlopen'd FFI calls) is *already* a working instance of this exact
// pattern — a type-tagged descriptor plus a JIT'd/interpreted dispatcher —
// just applied only to runtime-`dlopen`'d libraries today. `lo_fn_desc_t`
// below generalizes that same shape to every statically-registered binding
// too, so `lib/gen.js` stops emitting per-function C++ and instead emits
// one static table per binding (see doc/ABI.md's Option 1 sketch).
//
// Design principles carried over from doc/ABI.md, not re-derived here:
// pure C, `extern "C"` everywhere, no C++ types cross the boundary; one
// calling convention (no V8-style Fast/Slow split baked into the ABI
// itself — an engine backend is free to JIT a fast path under the hood,
// invisibly); explicit handle lifetimes (`lo_value_ref`/`lo_value_unref`);
// errors are a status code plus a pending-exception flag, never a C++
// exception crossing this boundary.
//
// Deliberately kept smaller in scope than a NAPI-equivalent surface would
// be: no generic "build me an arbitrary JS object graph" API (no
// lo_object_set_property-style calls, no array/class-construction helpers).
// `lo`'s own design principle is JS-heavy/native-light — native code hands
// JS primitives (numbers, pointers, buffers, strings, callable functions)
// and JS composes them, the same shape MODULES.md's "policy in JS, syscalls
// in C++" conclusion already settled on for module loading in the `jsc-lo`
// prototype. So this header is deliberately thin compared to what NAPI
// exposes, on purpose, not as a first-draft omission.
//
// Naming note, diverging intentionally from doc/ABI.md's original sketch:
// that doc used `lo_module_t` for "exports object under construction"
// during binding registration. Renamed here to `lo_exports_t`, freeing up
// `lo_module_t` for what `lo`'s own JS API already calls a module — an ES
// module record (`lo.loadModule`/`evaluateModule`/`unloadModule`) — so the
// name doesn't mean two different things forty lines apart.

#pragma once

#include <stddef.h>
#include <stdint.h>

#if defined _WIN32 || defined __CYGWIN__
#define LO_ABI_PUBLIC __declspec(dllexport)
#else
#define LO_ABI_PUBLIC __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

// ---------------------------------------------------------------------
// Versioning (doc/ABI.md's "not addressed here" item — WORK.E.4).
//
// Every `lo_register_*` entry point (bottom of this file) receives the
// engine's ABI version so a binding built against an older/newer header
// can refuse to load cleanly instead of misreading struct layouts. This
// is a stub, not a negotiation protocol: bumping MAJOR means "binary
// incompatible," MINOR means "additive, old bindings still load."
// ---------------------------------------------------------------------

#define LO_ABI_VERSION_MAJOR 0
#define LO_ABI_VERSION_MINOR 1

static inline uint32_t lo_abi_version(void) {
  return ((uint32_t)LO_ABI_VERSION_MAJOR << 16) | (uint32_t)LO_ABI_VERSION_MINOR;
}

// ---------------------------------------------------------------------
// Opaque handles. No visible definition anywhere in this header — every
// engine backend (V8/JSC/QuickJS) defines these as it likes internally.
// ---------------------------------------------------------------------

// One GC heap on one OS thread. What V8 calls an Isolate, JSC a
// JSContextGroup, QuickJS a JSRuntime — see doc/API.md's terminology
// section for why "engine" was picked over "isolate"/"runtime". `lo`'s
// current model is one lo_engine_t per OS thread, never shared across
// threads (see lib/worker.js's Worker class) — this header doesn't need
// to change that model, just name it engine-neutrally.
typedef struct lo_engine lo_engine_t;

// One global realm (what V8 calls a Context) hosted inside an engine.
// `lo` today creates exactly one realm per engine and never more — this
// type exists now so the 1:1 assumption is a fact about today's usage,
// not baked into the ABI's shape.
typedef struct lo_realm lo_realm_t;

// An opaque JS value handle. Valid only for the duration of the current
// native call by default (mirrors v8::Local's handle-scope lifetime) —
// see lo_value_ref/lo_value_unref below for anything that needs to
// outlive one call.
typedef struct lo_value lo_value_t;

// The "current call" — arguments in, return value out. Opaque; walked
// via the lo_arg_*/lo_return_* accessors below.
typedef struct lo_args lo_args_t;

// An exports object under construction during binding registration (see
// lo_register_fn at the bottom of this file). Distinct from lo_module_t
// (an ES module record) — see the naming note at the top of this file.
typedef struct lo_exports lo_exports_t;

// An ES module record — lo.loadModule/evaluateModule/unloadModule's
// JS-facing counterpart (doc/API.md's "Module system" table).
typedef struct lo_module lo_module_t;

// ---------------------------------------------------------------------
// Status codes. No C++ exceptions cross this boundary — a function
// either returns a status directly, or (for functions that hand back a
// lo_value_t*) returns NULL on failure and leaves a pending exception on
// the engine, checked via lo_engine_has_exception/lo_engine_throw below.
// ---------------------------------------------------------------------

typedef enum {
  LO_OK = 0,
  LO_ERROR = 1,           // pending JS exception on the engine — propagate, don't inspect further
  LO_INVALID_ARG = 2,
  LO_OUT_OF_MEMORY = 3,
  LO_TYPE_MISMATCH = 4,
  LO_NOT_IMPLEMENTED = 5, // this engine backend doesn't support the call (see Tier 3 note below)
} lo_status_t;

LO_ABI_PUBLIC void lo_engine_throw(lo_engine_t* engine, const char* message);
LO_ABI_PUBLIC int lo_engine_has_exception(lo_engine_t* engine);

// ---------------------------------------------------------------------
// Type tag vocabulary. Extends today's lo.h `FastTypes` enum (already
// engine-neutral in spirit — see doc/ABI.md) rather than inventing a new
// one. Used both by lo_fn_desc_t below (describing a native function's
// signature) and by the arg/return accessors (describing what's being
// read/written).
// ---------------------------------------------------------------------

typedef enum {
  LO_I8 = 1, LO_I16 = 2, LO_I32 = 3, LO_U8 = 4, LO_U16 = 5, LO_U32 = 6,
  LO_VOID = 7, LO_F32 = 8, LO_F64 = 9, LO_U64 = 10, LO_I64 = 11,
  LO_ISIZE = 12, LO_USIZE = 13, LO_POINTER = 14, LO_BUFFER = 15,
  LO_FUNCTION = 16, LO_U32ARRAY = 17, LO_BOOL = 18, LO_STRING = 19,
} lo_type_t;

// ---------------------------------------------------------------------
// Value handles: lifetime and introspection.
// ---------------------------------------------------------------------

// Retain a value past the current call (mirrors v8::Global, JSC's
// JSValueProtect, QuickJS's JS_DupValue+refcounting under the hood —
// each engine backend picks its own mechanism). Must be paired with
// lo_value_unref or it leaks for the lifetime of the engine.
LO_ABI_PUBLIC lo_value_t* lo_value_ref(lo_engine_t*, lo_value_t*);
LO_ABI_PUBLIC void lo_value_unref(lo_engine_t*, lo_value_t*);

LO_ABI_PUBLIC lo_type_t lo_value_type(lo_engine_t*, lo_value_t*);

// ---------------------------------------------------------------------
// Argument/return accessors — the one calling convention for the "raw"
// callback shape (lo_raw_fn_t below). NOT used by the typed native-call
// path (lo_fn_desc_t's `fn`, called directly with ordinary C parameter
// types once unmarshaled) — that path never sees an lo_args_t at all.
// This accessor set exists for the escape hatch: anything a flat
// lo_type_t signature can't express (structs by value, multiple returns,
// variable arity, module loading, memory wrapping with a custom deleter)
// still needs full control over argument reading and the return slot,
// the same role core's `preamble`/`bind_slowcallSlow` plays today.
//
// Illustrative subset shown — one accessor per lo_type_t, same pattern,
// omitted here (see doc/ABI.md's "Not addressed here").
// ---------------------------------------------------------------------

LO_ABI_PUBLIC uint32_t lo_args_count(lo_args_t*);

LO_ABI_PUBLIC int32_t   lo_arg_i32(lo_args_t*, uint32_t index);
LO_ABI_PUBLIC uint64_t  lo_arg_u64(lo_args_t*, uint32_t index);
LO_ABI_PUBLIC double    lo_arg_f64(lo_args_t*, uint32_t index);
LO_ABI_PUBLIC void*     lo_arg_pointer(lo_args_t*, uint32_t index);
LO_ABI_PUBLIC lo_value_t* lo_arg_value(lo_args_t*, uint32_t index); // escape hatch: raw handle, any type
// const char* lo_arg_string(lo_args_t*, uint32_t index, uint32_t* len_out); ... etc

LO_ABI_PUBLIC void lo_return_i32(lo_args_t*, int32_t);
LO_ABI_PUBLIC void lo_return_u64(lo_args_t*, uint64_t);
LO_ABI_PUBLIC void lo_return_f64(lo_args_t*, double);
LO_ABI_PUBLIC void lo_return_pointer(lo_args_t*, void*);
LO_ABI_PUBLIC void lo_return_value(lo_args_t*, lo_value_t*);
// void lo_return_string(lo_args_t*, const char*, uint32_t len); ... etc

// The raw/escape-hatch callback shape — generalizes what core's
// `preamble` hand-writes today (SlowCallback-style, full control, reads
// args itself). Return LO_ERROR after calling lo_engine_throw to signal
// a thrown exception; any other status is a native-side contract
// violation, not a JS-catchable error.
typedef lo_status_t (*lo_raw_fn_t)(lo_engine_t*, lo_realm_t*, lo_args_t*);

// ---------------------------------------------------------------------
// Function registration — Option 1's generic descriptor + shared
// dispatch. lib/gen.js emits one static array of these per binding
// instead of per-function C++; the engine backend interprets the array
// generically at registration time (or JITs a specialized trampoline per
// descriptor, reusing lib/asm/*'s existing mmap+mprotect JIT — an
// implementation detail of the backend, invisible here either way; see
// doc/ABI.md's "Where this leaves it").
//
// This is, structurally, `lib/core/api.js`'s existing `struct fastcall`
// (result/nparam/param[]/fn) generalized from "one dlopen'd FFI call,
// described at runtime by JS" to "every registered function, described
// at compile time by lib/gen.js" — same shape, wider use.
// ---------------------------------------------------------------------

#define LO_FN_RAW 0x1u // fn has lo_raw_fn_t's signature; ignore result/params/nparams below

typedef struct {
  const char* name;
  lo_type_t result;
  const lo_type_t* params;  // NULL/unused if flags & LO_FN_RAW
  uint8_t nparams;          // 0 if flags & LO_FN_RAW
  void* fn;                 // ordinary C fn ptr (e.g. int32_t(*)(int32_t,int32_t)), or lo_raw_fn_t if LO_FN_RAW
  // Optional V8 Fast API Call entry point -- NULL if this function has no
  // fast path (a string/f32/f64/i64/u64 param or result, currently; see
  // lo_abi_v8.cc's ToFastCType). When set, a real, concretely-typed
  // wrapper matching `result`/`params` exactly (codegen'd per function by
  // lib/gen.js's bindingsAbi(), not a generic dispatcher -- V8 calls this
  // directly with real native argument types in real ABI registers, so
  // it can't be one shared function the way `fn`'s slow-path caller is).
  // No receiver parameter -- this repo's own V8 patch
  // (patches/15.3-cfunctioninfo-has-receiver-kno.patch) removed the need
  // for one; see doc/WORK.E.1.md.
  void* fast_fn;
  // Optional per-parameter "computed, not caller-supplied" markers --
  // NULL if this function has no such parameters (the common case).
  // Otherwise an `nparams`-length array, one entry per position:
  //   - LO_NO_OVERRIDE (0xFF): read normally, the caller passes this
  //     JS argument.
  //   - LO_OVERRIDE_LITERAL_ZERO (0xFE): don't read a JS argument here
  //     at all -- always pass a literal 0.
  //   - any other value N (< kMaxArgs, see lo_abi_v8.cc): don't read a
  //     JS argument here either -- pass strlen() of the already-
  //     marshaled LO_STRING at parameter index N instead.
  // Covers the two real shapes every binding's own V8-specific-codegen
  // `override` field actually uses, surveyed directly across all 13
  // real call sites, not guessed: a trailing length parameter derived
  // from a preceding string (e.g. `write_string(fd, str)` calling the
  // real 3-arg `write(fd, buf, len)`), and a trailing literal-0 flags
  // parameter (`net`'s `send_string`). Not a general field-access/
  // constant-substitution mechanism the way the V8-specific codegen's
  // `override` is (that also allows arbitrary Number/String literals
  // and arbitrary field expressions, unused by any real binding today).
  // Overridden positions must be trailing (no ordinary parameter may
  // follow one) -- lib/gen.js enforces this at generation time.
  const uint8_t* overrides;
  uint32_t flags;
} lo_fn_desc_t;

#define LO_NO_OVERRIDE 0xFFu
#define LO_OVERRIDE_LITERAL_ZERO 0xFEu

LO_ABI_PUBLIC lo_status_t lo_register_functions(lo_engine_t*, lo_exports_t*,
  const lo_fn_desc_t* fns, uint32_t count);

// Constants/struct-sizeof-style values — covers today's `constants`/
// `structs` codegen (lib/gen.js's initConstant/initStruct), already
// engine-agnostic in spirit.
LO_ABI_PUBLIC lo_status_t lo_exports_set_i32(lo_exports_t*, const char* name, int32_t);
LO_ABI_PUBLIC lo_status_t lo_exports_set_u64(lo_exports_t*, const char* name, uint64_t);
LO_ABI_PUBLIC lo_status_t lo_exports_set_string(lo_exports_t*, const char* name, const char*);

// The entry point every binding exports, resolved by name (today's
// `_register_<name>` convention/`modules_add` table — see doc/ABI.md;
// unchanged here, just given a portable signature instead of a `void*`
// that gets reinterpret_cast to a V8-typed function pointer).
typedef lo_status_t (*lo_register_fn)(lo_engine_t*, lo_realm_t*, lo_exports_t*, uint32_t abi_version);

// Helper for a binding's own .cc file:
//   LO_REGISTER(epoll) { lo_register_functions(engine, exports, epoll_fns, N); return LO_OK; }
#ifdef __cplusplus
#define LO_REGISTER_LINKAGE extern "C"
#else
#define LO_REGISTER_LINKAGE
#endif
#define LO_REGISTER(name) \
  LO_REGISTER_LINKAGE LO_ABI_PUBLIC lo_status_t lo_register_##name( \
    lo_engine_t* engine, lo_realm_t* realm, lo_exports_t* exports, uint32_t abi_version)

// Implemented once, in lo_abi_v8.cc, compiled only into the runtime
// itself (not into any binding's own .a/.so — see lib/build.js's
// compile_bindings) and resolved by a dynamically-loaded binding at
// dlopen time (-rdynamic), same mechanism lo.h's SET_VALUE/
// SET_FAST_METHOD/SET_MODULE already rely on. Fully portable signature —
// no v8:: (or any engine-specific type) appears here, only inside
// lo_abi_v8.cc's own GenericInit<Slot>/kInitTable — so a binding calling
// this (via LO_ABI_V8_REGISTER below) genuinely never touches the
// engine, not even indirectly. Returns an opaque `void*` matching what
// `_register_<name>()` itself must return per today's `_register_<name>
// () -> void*`/InitializerCallback convention (lo.h, main.h).
LO_ABI_PUBLIC void* lo_abi_v8_register_binding(lo_register_fn fn, const char* name);

// Helper for a binding's own generated .cc file (lib/gen.js's
// bindingsAbi() emits this automatically) — the `_register_<name>()`
// entry point `main.js`'s loader actually calls, wired to the portable
// registration function above instead of a per-binding, engine-specific
// Init function.
#define LO_ABI_V8_REGISTER(name) \
  LO_REGISTER_LINKAGE LO_ABI_PUBLIC void* _register_##name() { \
    return lo_abi_v8_register_binding(lo_register_##name, #name); \
  }

// ---------------------------------------------------------------------
// Memory wrapping (WORK.C.3). "Wrap (ptr, len) as a JS (Shared)ArrayBuffer,
// optionally freeing it via a given deleter on collection" — one ABI
// entry point per doc/ABI.md's sketch, one implementation per engine
// backend using whichever of V8's NewBackingStore /
// JSObjectMakeArrayBufferWithBytesNoCopy / QuickJS's JS_NewArrayBuffer
// applies. `free_fn` NULL means the caller retains ownership (today's
// `lo`'s only gap here — see doc/CODE_REVIEW.md finding #6 — is that
// there's exactly one deletion strategy, `free()`; a real implementation
// of this entry point should let `free_fn` be any deleter, not assume
// libc `free`).
// ---------------------------------------------------------------------

typedef void (*lo_free_fn_t)(void* data, size_t length, void* deleter_data);

LO_ABI_PUBLIC lo_value_t* lo_wrap_memory(lo_engine_t*, lo_realm_t*,
  void* ptr, size_t len, int shared, lo_free_fn_t free_fn, void* deleter_data);
LO_ABI_PUBLIC lo_status_t lo_unwrap_memory(lo_engine_t*, lo_value_t* array_buffer,
  void** ptr_out, size_t* len_out);

// ---------------------------------------------------------------------
// ES module system (WORK.C.6). Portable concept, meaningfully different
// mechanism per engine (doc/API.md Tier 2) — QuickJS's JS_Eval+
// JS_EVAL_TYPE_MODULE/JS_SetModuleLoaderFunc is a close conceptual match
// to this shape already; JSC needs its internal Completion.h API + a
// custom JSGlobalObject (verified working — see jsc-lo/doc/MODULES.md)
// since its public C API has none of this. Resolve/fetch are callbacks
// into JS by design (jsc-lo/doc/MODULES.md's "do resolve/fetch in JS, not
// C++" conclusion), not something this ABI does policy for.
// ---------------------------------------------------------------------

typedef lo_value_t* (*lo_module_resolve_fn)(lo_engine_t*, lo_realm_t*,
  const char* specifier, const char* referrer); // must return synchronously
typedef lo_value_t* (*lo_module_fetch_fn)(lo_engine_t*, lo_realm_t*,
  const char* resolved_key); // returns a Promise<string>-shaped lo_value_t*

LO_ABI_PUBLIC lo_status_t lo_realm_set_module_callbacks(lo_realm_t*,
  lo_module_resolve_fn, lo_module_fetch_fn);
LO_ABI_PUBLIC lo_module_t* lo_module_load(lo_realm_t*, const char* source,
  const char* path, int cache);
LO_ABI_PUBLIC lo_status_t lo_module_unload(lo_realm_t*, lo_module_t*);
LO_ABI_PUBLIC lo_value_t* lo_module_evaluate(lo_realm_t*, lo_module_t*);
LO_ABI_PUBLIC lo_status_t lo_realm_run_microtasks(lo_realm_t*); // vm.drainMicrotasks() equivalent

// ---------------------------------------------------------------------
// Builtins/library registries (doc/API.md "Module system" table). Pure
// C++ data already, engine-neutral as-is — kept here only because
// they're part of the JS-facing `lo.*` surface this header exists to
// support.
// ---------------------------------------------------------------------

LO_ABI_PUBLIC lo_value_t* lo_builtin_get(lo_engine_t*, const char* name, int as_buffer);
LO_ABI_PUBLIC lo_value_t* lo_library_load(lo_engine_t*, lo_realm_t*, const char* name_or_address);

// ---------------------------------------------------------------------
// Engine/realm lifecycle. Recasts today's isolate_context/
// lo_create_isolate_context/lo_start_isolate/lo_destroy_isolate_context/
// lo_shutdown (lo.h, already engine-neutral in *shape* per doc/API.md —
// plain POD, one stable C entry point a new OS thread calls) around
// lo_engine_t/lo_realm_t instead of a bare `void* isolate`. Field names
// track lo.h's `struct isolate_context` directly so the mapping is
// obvious; fixes the missing-null-terminator bug from
// doc/CODE_REVIEW.md finding #1 by construction (lengths are explicit
// and copies are this struct's job, not three hand-rolled call sites).
// ---------------------------------------------------------------------

typedef struct {
  uint64_t start;          // hrtime() at process start, for JS-side "time to boot" measurement
  int argc;
  char** argv;
  const char* main_src;    // bootstrap script source (was `main`)
  unsigned int main_len;
  const char* js_src;      // optional secondary source (was `js`)
  unsigned int js_len;
  char* buf;
  int buflen;
  int fd;
  const char* globalobj;   // name of the runtime global, e.g. "lo"
  const char* scriptname;
  int cleanup;
  int onexit;
  void* startup_data;      // opaque engine-specific snapshot/startup blob
} lo_engine_config_t;

LO_ABI_PUBLIC size_t lo_engine_config_size(void);
LO_ABI_PUBLIC lo_engine_t* lo_engine_create(const lo_engine_config_t*); // == today's lo_create_isolate_context + lo_start_isolate, same thread
LO_ABI_PUBLIC void lo_engine_destroy(lo_engine_t*);
LO_ABI_PUBLIC void lo_shutdown(int cleanup); // process-wide, mirrors today's lo_shutdown

// ---------------------------------------------------------------------
// Cross-thread callback ABI (today's exec_info/callback_state,
// lo_callback/lo_async_callback). `fn_ref` replaces
// `v8::Global<v8::Function>` with a ref'd lo_value_t* (see
// lo_value_ref above) — the only engine-typed field in today's version
// of this struct, per doc/API.md, and now not engine-typed at all.
// lo_async_callback's queue itself is already engine-agnostic in design
// (doc/API.md); doc/CODE_REVIEW.md finding #4's `volatile int` bug is a
// correctness fix to make there, not a portability one — not repeated
// here.
//
// Named lo_abi_call/lo_abi_call_async here, not lo_callback/
// lo_async_callback — found the hard way (WORK.E.1's prototype links this
// header alongside the real lo.h in the same binary): lo.h already
// declares lo_callback(exec_info*)/lo_async_callback(exec_info*,
// callback_state*) with incompatible pointer types, and both are
// extern "C", so the identical names collide as soon as both headers are
// included together — which any transitional build doing exactly what
// this prototype does will need. These are meant to supersede lo.h's
// versions once a real ABI cutover happens (at which point they could
// reclaim the shorter names); until then, coexistence requires distinct
// symbols.
// ---------------------------------------------------------------------

typedef struct {
  lo_engine_t* engine;
  lo_value_t* fn_ref;  // lo_value_ref'd JS function, called back into
  uint64_t rv;
  int nargs;
} lo_exec_info_t;

LO_ABI_PUBLIC void lo_abi_call(lo_exec_info_t* info); // same-thread only, like today's lo_callback
LO_ABI_PUBLIC void lo_abi_call_async(lo_exec_info_t* info, void* queue_state); // cross-thread; queue_state opaque, see note above

// ---------------------------------------------------------------------
// Deliberately NOT here (doc/API.md Tier 3 — engine-specific, no real
// cross-engine equivalent): heap_usage/shm_usage/setFlags, and the
// isOneByte/isTwoByte/isExternalOneByte bits of get_meta. Per WORK.C.8,
// these live behind an explicit engine-specific header
// (e.g. lo_v8_abi.h) instead of pretending to be portable — not sketched
// in this pass.
// ---------------------------------------------------------------------

#ifdef __cplusplus
}
#endif
