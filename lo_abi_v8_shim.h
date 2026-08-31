// lo_abi_v8_shim.h — the part of lo_abi_v8.cc's V8 backend that every
// individual lo_abi.h-targeted binding's own generated .cc needs too, not
// just lo_abi_v8.cc itself: ExportsImpl (the concrete type behind the
// opaque lo_exports_t) and the LO_ABI_V8_BINDING(name) registration shim.
//
// Split out because the shim macro expands to a real, per-binding
// Init(Isolate*, Local<ObjectTemplate>) function with no way to close over
// extra context (InitializerCallback is a plain function pointer, not a
// capturing lambda) -- so it has to be instantiated once per binding name,
// at compile time, in that binding's own translation unit, not centrally
// in lo_abi_v8.cc (which would mean hand-editing a shared file for every
// new binding -- exactly the "still needs to live here" gap this header
// removes; see doc/WORK.E.1.md). lib/gen.js's bindingsAbi() includes this
// header and emits LO_ABI_V8_BINDING(<name>) automatically now.
//
// Each binding's own generated .cc gets its own internal-linkage copy of
// everything here (anonymous namespace) -- same as if it were hand-copied
// per file, just written once. No ODR concerns: nothing here is ever
// referenced across translation units.

#pragma once

#include "lo.h"
#include "lo_abi.h"

namespace {

// The concrete definition behind the opaque lo_exports_t declared in
// lo_abi.h — "an exports object under construction," backed by a real
// V8 ObjectTemplate for this engine. Lives only as long as one
// registration call (see the shim below) — never persisted past it.
struct ExportsImpl {
  v8::Isolate* isolate;
  v8::Local<v8::ObjectTemplate> tmpl;
};

inline v8::Isolate* AsIsolate(lo_engine_t* engine) {
  return reinterpret_cast<v8::Isolate*>(engine);
}

inline ExportsImpl* AsExports(lo_exports_t* exports) {
  return reinterpret_cast<ExportsImpl*>(exports);
}

} // namespace

// Registration shim: adapts today's `_register_<name>() -> void*` /
// InitializerCallback convention (see lo.h, main.h) to the portable
// `lo_register_<name>(engine, realm, exports, abi_version)` entry point a
// lo_abi.h-targeted binding actually exports.
#define LO_ABI_V8_BINDING(name) \
  extern "C" lo_status_t lo_register_##name( \
    lo_engine_t*, lo_realm_t*, lo_exports_t*, uint32_t); \
  namespace lo { namespace name##_abi_shim { \
    void Init(v8::Isolate* isolate, v8::Local<v8::ObjectTemplate> target) { \
      ExportsImpl impl{isolate, v8::ObjectTemplate::New(isolate)}; \
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
