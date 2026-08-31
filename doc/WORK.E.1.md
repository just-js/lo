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

**Update, follow-on session: no longer fully open.** A smoke test proved
the mechanism for the narrowest real shape (0 params, `LO_VOID` result) —
see "Result" below. The `void* receiver` wrinkle turned out to be
mechanical, not hard. The harder part flagged for the *next* pass, not
yet done: generalizing past this one shape needs real per-register-class
typing (float/double args must be genuinely typed `double`/`float` in the
fast callback's C++ signature so SysV/AAPCS64 places them in the XMM vs.
general-purpose register file correctly) — the slow path's "cast
everything to `uint64_t` and call through one canonical signature" trick
does not carry over to the fast path, since Fast API Calls skip V8's
boxed-`Value` marshaling entirely and call with the real native types
directly.

**Update, later session: the `void* receiver` wrinkle is gone for real,
not just worked around.** `repos/v8`'s own patch
(`patches/15.3-cfunctioninfo-has-receiver-kno.patch`, adapting Node's
closed `nodejs/node#63140`) landed in a real CI build
([run `33341673702`](https://github.com/just-js/v8/actions/runs/33341673702),
V8 15.3.76, confirmed via `include/v8-fast-api-calls.h`'s `HasReceiver`
enum) and `lo` has been rebuilt against it. The `LO_V8_HAS_RECEIVER_KNO`
adapter this section originally shipped as a stopgap is deleted from
`lo_abi_v8.cc` — `DispatchInt32Fast_Core` installs directly as the
`CFunction` target now, with `CFunctionInfo::HasReceiver::kNo`
unconditional, no leading ignored parameter. Verified, not assumed:
`test/abi.js` passes clean against the rebuilt `foo`/`foo_abi` bindings,
and `bench-abi.js` shows `foo_abi.add1` (the int32 tier this shim
covered) at ~4.2-5.2ns/call and `foo_abi.noop` at ~4.5-5.6ns/call — both
in the hundreds-of-millions-calls/sec range consistent with the Fast API
Call path genuinely being taken, not a slow-path fallback.

Real, non-obvious gotcha hit getting there: any `lib/*/*.so` binding
still compiled against the pre-patch V8 segfaults on `dlopen` against the
new monolith (confirmed with `lib/foo/foo.so` specifically — crashed on
load, before any call; rebuilding it against the current V8 fixed it).
Anything else still linking the old `libv8_monolith.a`'s ABI will need
the same rebuild before use.

The 0-arg tier (`DispatchNoArgsFast`) never had this adapter — a true
0-arg Fast API Call still had nothing *but* the receiver to accept before
the patch, so it always took one directly rather than wrapping a receiver-
free "core" function. Now that `HasReceiver::kNo` is real, that tier can
drop its `void* receiver` parameter too — not done here, in scope for the
next pass generalizing past these two proof-of-concept shapes.

## Result (follow-on session, `foo`/`foo_abi` rather than `encode`/`encode_abi`)

Prototyped and benchmarked essentially as planned, with two deliberate
deviations from the plan above, both because they turned out to be
unnecessary for what the benchmark needed:

- **`lib/foo_abi`** (a new, minimal single-function `noop()` binding) was
  used instead of `lib/encode_abi` — simplest possible shape first, so a
  side-by-side benchmark (`bench-abi.js`) could isolate dispatch overhead
  itself before adding argument-marshaling complexity. `lib/encode_abi`
  (already committed, `api.js` only) remains the natural next binding to
  port once more shapes are validated.
- **Steps 5-7 (wire into `main.h`, recompile `main.cc`, a separate
  `lo_abi` binary) turned out unnecessary.** `main.js`'s `load()` already
  `dlopen`s `lib/<name>/<name>.so` and resolves `_register_<name>` at
  runtime for *any* binding, static-`main.h`-registered or not — so
  `foo_abi.so` works as a normal dynamically-loaded binding against the
  real, unmodified `lo` binary. Wiring into `main.h` is only needed for a
  binding that should ship *statically linked into* `lo` itself, which
  was never a requirement here.

What was actually built, well beyond "prove it compiles and returns
correct results":

- `lo_abi_v8.cc`: a real, generalized V8 backend — `lo_register_functions`
  picks one of **three dispatch tiers** per descriptor at registration
  time (0-arg / primitive-args / has-a-string-arg), each a family of
  `kMaxSlots` compile-time template instantiations indexed by registration
  slot, so no call ever touches `FunctionTemplate::Data()` at all (see
  "Why three tiers" below).
- A working **V8 Fast API Call smoke test**, narrowly scoped to the 0-arg/
  `LO_VOID` shape — dynamically-built `CTypeInfo`/`CFunctionInfo`/
  `CFunction`, confirmed via `perf` to actually be taken by Turbofan/
  Maglev after warmup (not just reachable in principle).
- Real, measured performance, not assumed:

  | Version | ns/call (0-arg `noop()`) | vs. hand-generated |
  |---|---|---|
  | Generated (`lib/gen.js`), fast+slow paths (real baseline) | ~9ns | — |
  | ABI, `v8::External`-based `Data()` | ~17ns | ~1.9x |
  | ABI, internal-field `Data()` | ~19-22ns | ~2.2x (mechanism swap alone didn't help — see below) |
  | ABI, `Data()` eliminated (static descriptor, single-function test) | ~12ns | ~1.4x |
  | ABI, three-tier split (0-arg tier, no `Data()`) | ~10.5ns | ~1.17x |
  | ABI, three-tier + Fast API Call smoke test | **parity** | **1.0x** |

  Why three tiers, not one dispatcher: `perf annotate`/`objdump` (see
  [`PROFILING.md`](PROFILING.md)) showed two distinct, separately-measured
  costs, not one — (1) `args.Data()` itself costs ~9ns/call regardless of
  *what's* stored in it (`v8::External` vs. an internal field never
  mattered; V8's own `GetFunctionTemplateData` mints a fresh `Handle`
  every call), and (2) a single monolithic dispatcher forces even a 0-arg
  call to pay for the worst case's register pressure — `objdump` showed 6
  callee-saved register pushes and a stack-protector canary on *every*
  call, because the compiler sizes a function's prologue for its whole
  body (the multi-arg/string-handling branch), not the branch actually
  taken. Splitting by shape fixes (2) directly; avoiding `Data()` (via
  the per-slot template table) fixes (1).

Full investigation, including the `perf`/`objdump` commands used and the
tail-call-optimization detour while trying to get a fair non-inlined
baseline (`__attribute__((not_tail_called))`, not just `noinline`):
[`PROFILING.md`](PROFILING.md).

## A second unlock, beyond multi-engine portability: `-fvisibility=hidden` on V8 itself

Not just "bindings that survive an engine swap" — this also removes the
one thing currently forcing V8's own C++ API surface to stay exported.
Today, a generated binding (`foo.cc`, `lib/core/core.cc`, ...) calls
`v8::FunctionTemplate::New`/`v8::Isolate::*`/etc. *directly*, compiled
into its own `.so` and linked against wherever those symbols live — so
those symbols (thousands of them, across all of V8's public C++ classes)
have to stay visible across that link/dlopen boundary, or bindings fail
to resolve them. An `lo_abi.h`-targeted binding never touches `v8::` at
all — every call crosses through `lo_abi_v8.cc`'s narrow, curated
`extern "C"` surface (`lo_register_functions`, `lo_engine_throw`, ...)
instead. If *every* binding went through that boundary, nothing outside
`lo_abi_v8.cc` itself would need direct access to a `v8::` symbol, and
V8's own enormous public API surface could be built `-fvisibility=hidden`
(only the narrow `lo_*` `extern "C"` set staying exported) without
breaking anything — a real, additional binary-size/symbol-table lever
on top of the `symbol_level`/`v8_enable_webassembly`-style cuts already
tracked in `repos/v8`'s own `doc/V8-BUILD-OPTS.md`. Not attempted here —
noted because it falls out of this design directly, and is worth
remembering once more than one ABI-targeted binding exists to test it
against.

## Status

**Update, second follow-on session:** `lib/gen.js` codegen integration —
listed above as explicitly out of scope for this pass — is now done.
`bindingsAbi()` generates `lo_abi.h`-conformant code from the same
`api.js` shape the V8-specific `bindings()` already uses, selected via
`target = 'abi'` in a binding's own `api.js` (or `LO_GEN_TARGET` env var
override); `lib/build.js`'s `compile_bindings` compiles and links
`lo_abi_v8.cc` automatically for `target: 'abi'` bindings, no per-binding
hand-written `build.js` needed. `lib/foo_abi/foo_abi.cc` is now fully
auto-generated, not hand-written.

`lib/foo`/`lib/foo_abi` were consolidated onto one shared definitions
module (`lib/foo_abi/shared.js`, 14 functions — one per currently-
ABI-supported non-float `lo_type_t`) built under each target for direct
comparison (`bench-abi.js`, `test/abi.js`). Actually building and
cross-testing both targets against each other (not just against
themselves) surfaced three real, independent correctness bugs in under
an hour — none caught by code review alone. Full detail, plus a survey
of all 43 real `lib/*/api.js` bindings for what porting them actually
needs (headline: **constants block 56% of bindings — the single biggest
lever, well ahead of floats**, which only one binding needs): `WORK.md`
tasks `E.8`/`E.9`.

**Recommended next step for whoever picks this up**: implement
`lo_exports_set_i32`/`u64`/`string` in `lo_abi_v8.cc` (`lo_abi.h`
already declares them; nothing implements them yet) — per `E.9`, this
unblocks more real bindings than the remaining float/arity/fast-call
generalization work combined, and none of that work is blocked waiting
for it either, so there's no ordering risk in doing it first.

**Update, third follow-on session:** the patched V8 (15.3.76, with
`CFunctionInfo::HasReceiver::kNo`) is built and linked — see the
"Open question" section above for the verified before/after. The
`LO_V8_HAS_RECEIVER_KNO` shim referenced throughout this doc no longer
exists in `lo_abi_v8.cc`.

Same session, following straight on from that: **`E.9`'s recommended
"do first" step (constants) is done, and a real binding ported end to
end for the first time.** `lo_exports_set_i32`/`u64`/`string` are
implemented in `lo_abi_v8.cc` (`u32` shares `i32`'s setter, `i64` shares
`u64`'s — see `lib/gen.js`'s `initConstantAbi`, and `E.9`'s per-type
tally: 321 real `i32` constants, 26 `u64`, 17 `u32`, zero of anything
else, across all 43 bindings). Two more real gaps found immediately
while actually trying to port a real (not toy) binding — `lib/fsmount`,
chosen as the smallest binding blocked by *only* the constants gap, per
`E.9`'s table — neither guessed in advance:

- `bindingsAbi()` had no `includes` support at all (`fsmount` needs
  `<sys/mount.h>` for `mount`/`umount`/`umount2` themselves, not just
  its constants) — added, mirroring `bindings()`'s own plain-`includes`/
  `externs` handling (still no `linux`/`mac` OS-conditional variant,
  that's `E.9`'s separate still-open gap).
- The registration shim (`LO_ABI_V8_BINDING(name)`) only actually existed
  for `foo_abi`, hardcoded at the bottom of `lo_abi_v8.cc` itself — every
  new binding needed a hand-added line there, which doesn't scale (and
  meant `fsmount.so` *compiled* clean but had no `_register_fsmount`
  symbol at all, failing silently at `dlopen`/`dlsym` time, not build
  time — a real, non-obvious failure mode, not a guess). Fixed by moving
  `ExportsImpl` and the shim macro into a new shared header,
  `lo_abi_v8_shim.h`, that `lib/gen.js`'s `bindingsAbi()` now includes
  and instantiates (`LO_ABI_V8_BINDING(<name>)`) in every generated
  binding's own `.cc` — no more hand-editing `lo_abi_v8.cc` per binding.

Also found and fixed along the way, unrelated to the ABI path itself: a
real, previously-undiscovered bug in `lib/gen.js`'s *V8-specific*
`initConstant` — its `u64` branch called `BigInt::New` (which takes
`int64_t`), silently wrapping any real `u64` constant above `INT64_MAX`
to a negative value. Surfaced by the same cross-codegen constants test
(`test/abi.js`'s `FOO_BIG = 18446744073709551615n`) that validated the
new `lo_exports_set_u64` — `foo` (the V8-codegen baseline) failed it,
`foo_abi` didn't. Fixed with `BigInt::NewFromUnsigned`.

`fsmount` now builds under `LO_GEN_TARGET=abi` and, loaded via
`lo.load('fsmount')`, its real constants (`MS_RDONLY`, `MNT_FORCE`, ...)
and real syscalls (`umount()` on a nonexistent path correctly returns
`-1`) both verified working — the first real, non-`foo`/`foo_abi`
binding actually running through this ABI end to end.

Still not done: generalizing tiers 1/2's Fast API Call support past the
one `int32` proof of concept (needs the per-register-class typing noted
above, plus threading `Int64Representation` through for `i64`/`u64` —
see `E.8` — and dropping the 0-arg tier's now-unnecessary receiver
parameter too), porting a real multi-function binding (`lib/encode_abi`
is still the natural next candidate once constants work), and the
`bool`-as-result-type inconsistency between the two codegens (`E.8`).
