# WORK.E.1: prototype the `lo_abi.h` ABI against a real binding

Spec for the concrete next step on `WORK.E.1`/`WORK.E.2` (see
[`WORK.md`](WORK.md)): build a minimal, real, working proof that a binding
generated against [`lo_abi.h`](../lo_abi.h) can compile, link, register, and
run inside the actual V8-based `lo` runtime — not just type-check standalone
the way [`lib/epoll/epoll_abi.cc`](../lib/epoll/epoll_abi.cc) did.

## Goal

Prove the mechanism end-to-end: JS calls `lo.library('encode_abi')`, gets an
exports object back, calls its functions, gets correct results — all
through the generic `lo_fn_desc_t`/`lo_register_functions` dispatch path,
with zero `v8::` visible in the binding's own source.

## Non-goals (this pass)

- **Performance/Fast API Calls parity.** This proves correctness only, via
  V8's slow (`FunctionCallbackInfo`-based) call path. See "Open question"
  below — deliberately deferred, not solved here.
- **Touching the real `lib/encode`/`epoll` bindings, or the real `lo`
  binary.** Everything here is additive and separately named (`encode_abi`
  binding, `lo_abi` binary) so nothing existing can regress.
- **`lib/gen.js` codegen integration.** `encode_abi.cc` is hand-written to
  look like what `lib/gen.js` would emit — actually teaching the generator
  to target `lo_abi.h` is later, separate work.

## Why `lib/encode`, not `lib/epoll`

`epoll_abi.cc` only type-checked, since `sys/epoll.h`/`sys/prctl.h` are
Linux-only and this is a macOS dev box. [`lib/encode/api.js`](../lib/encode/api.js)
is pure portable C (no OS headers, implementation lives entirely in its
`preamble`) — six functions, and it exercises more of `lo_abi.h`'s type
vocabulary than `epoll` did: scalar (`u32`), pointer/`buffer`, and — the
interesting case — `string`.

## Plan

1. **`lib/encode_abi/api.js`** — copy of `lib/encode/api.js`, only the
   trailing `const name = 'encode'` changed to `'encode_abi'`. Per-function
   `name:` overrides (`base64_encode_str`/`base64_decode_str` calling
   through to the real `base64_encode`/`base64_decode` C symbols) stay as-is.
2. **`lib/encode_abi/encode_abi.cc`** — hand-written the same way
   `epoll_abi.cc` was: the `preamble`'s C functions copied in verbatim, one
   `lo_type_t[]` + `lo_fn_desc_t` row per function, one `LO_REGISTER(encode_abi)`
   entry point calling `lo_register_functions`. No constants — `encode` has
   none, so this binding needs nothing from `lo_abi.h` beyond
   `lo_register_functions`.
3. **`lo_abi_v8.cc`** — new file, the first real (if minimal) V8 backend for
   `lo_abi.h`. Scope: just enough to make step 2 work — `lo_engine_t`/
   `lo_exports_t` as thin wrappers around `v8::Isolate*`/
   `{Isolate*, Local<ObjectTemplate>}`, and `lo_register_functions` building
   one `FunctionTemplate` per descriptor via a shared generic dispatch
   callback (reads JS args per `desc->params[]`, calls `desc->fn`).
4. **Registration shim** — `_register_encode_abi()`, matching today's
   `void* (*)()` → `InitializerCallback` convention exactly (same shape as
   `_register_epoll` etc. in `main.h`), so nothing about `lo::Library()` or
   `main.js`'s loader needs to change. Internally wraps `Isolate*`/
   `Local<ObjectTemplate>` into the ABI's opaque types and calls
   `lo::encode_abi::lo_register_encode_abi(engine, realm, exports, abi_version)`.
5. **Wire into `main.h`** (hand-edited, not regenerated — `encode_abi` isn't
   part of any `runtime/*.config.js` binding list): one `extern void*
   _register_encode_abi();` in the `extern "C"` block, one
   `lo::modules_add("encode_abi", &_register_encode_abi);` in
   `register_builtins()`, following the existing pattern exactly.
6. **Build**: compile `lo_abi_v8.cc`, compile `lib/encode_abi/encode_abi.cc`,
   recompile `main.cc`, relink as a separate binary (`lo_abi`, not `lo`).
7. **Test**: a JS script that does `const encode_abi =
   lo.library('encode_abi')`, calls all six functions, and checks results
   against `lib/encode`'s real (already-working) output for the same
   inputs.

## Open question, deliberately not resolved here: V8 Fast API Calls

Checked against `lib/encode/encode.cc`'s real generated Fast paths:

- `hex_encode`/`hex_decode`/`base64_encode`/`base64_decode` (scalar/pointer
  params only) — Fast API Calls support looks achievable **generically**,
  later: build `CTypeInfo`/`CFunctionInfo`/`CFunction` from `desc->params[]`
  at registration time, same dynamic-construction trick `core`'s existing
  preamble (`bind_fastcallSlow`) already uses for `dlopen`'d FFI calls today
  — not new invention. One real wrinkle: V8's Fast API Calls convention
  always prepends an unused `void* receiver` as the first native parameter;
  a generic fast dispatcher needs to account for that.
- `base64_encode_str`/`base64_decode_str` — their *slow* path is portable
  (`LO_STRING`, already in `lo_abi.h`). Their *fast* path uses
  `struct FastOneByteString*`, V8's zero-copy pointer into its own internal
  one-byte-string storage — confirmed V8-only (matches `API.md`'s prior Tier
  2 finding), no equivalent on JSC/QuickJS's public APIs. Achievable only as
  an explicit, opt-in V8-backend extension on top of the portable ABI, never
  as a cross-engine `lo_type_t` tag.

Not designed in this pass. Next real question once this prototype lands.

## Status

Not started. Implementation begins when explicitly requested.
