# Work identified across `doc/*.md`

A flat pull of every discrete task raised in [`SUMMARY.md`](SUMMARY.md),
[`CODE_REVIEW.md`](CODE_REVIEW.md), [`ABI.md`](ABI.md), [`API.md`](API.md),
[`PROPOSAL.md`](PROPOSAL.md), [`BUILD.md`](BUILD.md), and the sibling
`jsc-lo` repo's `doc/MODULES.md`/`doc/BUILD.md`. Grouped by theme, not by
priority or dependency — see section A for what's still unresolved about
*order*. Each item names the doc section it came from so the reasoning
behind it doesn't need to be re-derived.

**Numbering convention**: each `##` section is lettered (A, B, C, ...) in
document order, and every task/concern inside a section is numbered
sequentially from 1 within that section (restarting at 1 in each new
section). Refer to a specific item elsewhere as `WORK.<letter>.<number>`,
e.g. `WORK.B.2` for the second item in section B. Numbers are permanent
once assigned — if an item is resolved, it's struck through and annotated
in place (see `WORK.A.3` for the pattern), not deleted or renumbered, so
existing `WORK.x.y` references never go stale. When adding new items to an
existing section, append at the end of that section's numbering rather
than inserting/renumbering.

## A. Open questions before sequencing

Things worth deciding before turning this into an ordered plan — none of
them block writing this list down, but all of them change what "next"
means:

**A.1** ~~ABI.md's Option 1 vs. Option 2 is explicitly undecided.~~
**Resolved: Option 1** (generic descriptor + shared dispatch, not
per-function codegen'd wrappers). A first-pass sketch of the resulting
ABI exists now: [`lo_abi.h`](../lo_abi.h) — `lo_fn_desc_t` +
`lo_register_functions` generalize `lib/core/api.js`'s existing
`struct fastcall` (already Option 1's shape, just scoped to `dlopen`'d FFI
calls today) to every registered binding. Not comprehensive — see
`WORK.E.2` for what's still needed before this is real.

**A.2** **How the two portability efforts relate isn't stated.** `API.md` is
about `lo`'s own core (isolate creation, module loading) running on a
different engine; `ABI.md` is about *bindings* not being compiled
against `v8::` directly. They're complementary, but nothing says whether
binding-ABI work should wait until a second engine backend exists, or
proceed now since it also shrinks the V8-only binary (per `PROPOSAL.md`).

**A.3** ~~Status of the in-progress local V8 build is unknown from the docs
alone.~~ **Resolved**: confirmed working in the sibling `../v8` repo —
`v8-14.7/out.gn/arm64.release/` has a built `v8_monolith` + `d8`, and
`build.sh`'s own smoke test (linking `test.cc` against the monolith)
passes. See section F for what this unblocks and what it doesn't yet do.

**A.4** **No stated priority between JSC and QuickJS.** JSC module loading is
now verified working (`jsc-lo`); QuickJS hasn't had the equivalent
hands-on pass (its `Atomics`/`SharedArrayBuffer` story is verified, but
nobody's built a `lo`-shaped module-loading proof of concept against it
the way `jsc-lo` did for JSC). Worth deciding whether to finish one
engine backend before starting the other, or run both in parallel now
that the two biggest unknowns are resolved.

**A.5** **Is `jsc-lo` a permanent home or a staging ground?** It's a from-scratch
minimal build with no bindings ported. At some point JSC support either
needs to become an `ENGINE=jsc` axis in `lo`'s own `Makefile`
(`WORK.C.6`) or `jsc-lo` needs to stay a separate artifact long-term —
not decided either way yet.

**A.6** **Windows scope for this phase.** Both `ABI.md` and `PROPOSAL.md`
explicitly leave Windows unaddressed (no dynamic-addon-loading analog to
`-bundle_loader`/`-rdynamic`, no `__declspec` export-control story). Worth
an explicit in-scope/deferred decision rather than letting it default to
"later" by omission.

## B. Correctness fixes (existing V8 runtime)

Independent of the multi-engine work — these are bugs in the runtime as it
stands today, unblocked by any open question in section A. Source:
[`CODE_REVIEW.md`](CODE_REVIEW.md).

**B.1** **Fix missing null terminator in `isolate_context` string copies.**
`lo_create_isolate_context` allocates `calloc(1, strnlen(...))` — zero
room for `\0` — then the copies get read back as C-strings, including one
*unbounded* `strlen()`. Real heap over-read on the live worker-thread
path. [`CODE_REVIEW.md` finding #1](CODE_REVIEW.md#concurrency--data-ownership).

**B.2** **Fix the dangling `module_map` pointer in `CreateIsolate`.**
`isolate->SetData(0, &module_map)` points at a stack-local that's
destructed before `cleanupIsolate`/`Dispose()` runs; works today by
accident. [`CODE_REVIEW.md` finding #2](CODE_REVIEW.md#concurrency--data-ownership).

**B.3** **Document (or enforce) the `builtins`/`modules` global-map threading
contract, and fix the shutdown leak.** Safe today only by write-once/
read-after convention, enforced nowhere; separately, `lo_shutdown`'s
`builtins.clear()` never `delete`s the `lo::builtin*` values, leaking
every registered builtin. [`CODE_REVIEW.md` finding #3](CODE_REVIEW.md#concurrency--data-ownership).

**B.4** **Replace the `volatile int` cross-thread counter in
`lo_async_callback` with real synchronization.** `volatile` gives no
atomicity or ordering guarantees in C++; the actual race spans the
counter *and* the array slot together, so `std::atomic` alone isn't even
enough — needs a mutex or a properly-designed lock-free ring buffer.
[`CODE_REVIEW.md` finding #4](CODE_REVIEW.md#concurrency--data-ownership).

**B.5** **Fix the lazy, unsynchronized `random_fd` open.** Cheap fix: initialize
it eagerly in `lo::Setup` (runs once, single-threaded, pre-isolate)
instead of lazily inside a callback that might fire per-isolate.
[`CODE_REVIEW.md` finding #5](CODE_REVIEW.md#concurrency--data-ownership).

**B.6** **Decide and document an ownership/free-strategy model for
`WrapMemory`/`WrapMemoryShared`.** Currently exactly one deletion
strategy (libc `free()`) with no provenance tracking — wrapping an
`mmap`'d JIT buffer with `free_memory=1` is UB today, and
`WrapMemoryShared` has no aliasing protection across isolates.
[`CODE_REVIEW.md` finding #6](CODE_REVIEW.md#correctness--robustness).

**B.7** **Make `EvaluateModule`'s error handling consistent with
`LoadModule`'s.** `LoadModule` correctly rethrows on failure;
`EvaluateModule` just `printf`s and returns `undefined` on both
`InstantiateModule` and `Evaluate` failure — silently swallows errors a
JS caller should be able to `catch`. [`CODE_REVIEW.md` finding #7](CODE_REVIEW.md#correctness--robustness).

**B.8** **Split `lo::CreateIsolate` into named phases.** One ~220-line function
doing isolate creation, global/context setup, compile, instantiate,
evaluate, and teardown inline — the dangling-`module_map` bug above is
precisely a scope-boundary problem this would make visible at a glance.
Also a hard prerequisite for the engine-backend decomposition in
`WORK.C.1` — same piece of work serves both goals.
[`CODE_REVIEW.md` finding #8](CODE_REVIEW.md#structural--readability).

**B.9** **Low priority cleanup**: delete or convert to `TODO` the commented-out/
superseded code scattered through `CreateIsolate`/`Init`.
[`CODE_REVIEW.md` finding #9](CODE_REVIEW.md#structural--readability).

**B.10** **Low priority cleanup**: narrow the 56 file-scope `using v8::X;`
declarations. [`CODE_REVIEW.md` finding #10](CODE_REVIEW.md#structural--readability) —
explicitly flagged in the doc itself as not worth prioritizing.

## C. Engine portability — `lo`'s own core

Making isolate creation, module loading, and memory wrapping work on an
engine backend other than V8. Source: [`API.md`](API.md#what-changes-los-own-design-needs),
verified/extended against real JSC and QuickJS source in `jsc-lo` and
`scratch/quickjs`.

**C.1** **Decompose `lo::CreateIsolate` into per-engine-backend phases.** Same
task as `WORK.B.8`, reframed as the first real step toward a second
engine backend existing at all — VM creation, global/realm setup,
module compile, module run, and teardown each need a per-engine
implementation behind a common sequence.

**C.2** **Fix, but don't redesign, the `isolate_context`/
`lo_create_isolate_context`/`lo_start_isolate` ABI.** Already
engine-neutral in shape (plain POD data, stable C entry point) — needs
the bug fixes from `WORK.B.1`, not a rework.

**C.3** **Design and implement one memory-wrapping abstraction point**: `wrap
(ptr, len) as a JS (Shared)ArrayBuffer, optional deleter` as a single
`lo_wrap_memory(engine, ptr, len, shared, free)`-shaped ABI entry, per
`ABI.md`'s sketch, implemented once per engine backend. Confirmed
feasible on all three engines — `ArrayBuffer::NewBackingStore` (V8),
`JSObjectMakeArrayBufferWithBytesNoCopy` (JSC), `JS_NewArrayBuffer` with
its `is_shared` flag (QuickJS) — same shape throughout.

**C.4** **Treat the FFI/JIT trampoline mechanism (`core`'s `bind_fastcall`/
`bind_slowcall`, `lib/ffi.js`, `lib/asm/*`) as the thing that needs to
work identically regardless of engine.** This is what makes *any* native
function call from JS portable, and it's the same mechanism `ABI.md`'s
Option 1 (`WORK.E.1`) wants to generalize — one piece of work serves
both docs.

**C.5** **Make Fast API Calls (`CFunction`/`CTypeInfo`,
`SET_FAST_METHOD`/`SET_FAST_PROP`) an explicit, optional, V8-only
acceleration.** Every `lo.*` entry needs a working non-fast
implementation as the guaranteed contract; JSC/QuickJS simply don't have
an equivalent, and shouldn't need one to be otherwise complete.

**C.6** **Build the module-loading + microtask-draining backend abstraction.**
Flagged as the single biggest portability risk in the original
assessment; JSC's side of it is now verified (see section D). QuickJS
has a close conceptual match already (`JS_Eval`+`JS_EVAL_TYPE_MODULE`,
`JS_SetModuleLoaderFunc`, `JS_EnqueueJob`/`JS_ExecutePendingJob`) but
hasn't had a hands-on `lo`-shaped proof of concept the way JSC just did.

**C.7** **Add an `ENGINE=v8|jsc|quickjs` build axis to the Makefile.** Fits the
existing `runtime/*.config.js` pattern that already selects
bindings/builtins per build; one engine per binary, not multiple engines
coexisting at runtime — nothing in the API surface requires more than
that.

**C.8** **Move the Tier 3, genuinely engine-specific entries
(`heap_usage`, `shm_usage`, `setFlags`, the `isOneByte`/`isTwoByte`/
`isExternalOneByte` bits of `get_meta`) behind an explicit `lo.v8.*`
namespace** rather than pretending they're universal — same treatment
`ABI.md` already proposes for the `heap` binding's `v8::HeapProfiler`
usage.

All of the above: [`API.md` § "What changes `lo`'s own design needs"](API.md#what-changes-los-own-design-needs).

## D. JSC backend — concrete next steps

The module-loading mechanism itself is now verified (a standalone
experiment in `jsc-lo/scratch/modules-experiment/` resolves, fetches, and
evaluates a real `import` graph via the internal `Completion.h` API). What's
left is wiring it into `jsc-lo`'s actual runtime and filling in the gaps the
experiment deliberately skipped. Source: `jsc-lo`'s
[`doc/MODULES.md`](../../jsc-lo/doc/MODULES.md).

**D.1** **Land `lo`'s own syscall/fs interface in `jsc-lo`** (file read at
minimum: resolved path → bytes or error) — the experiment's
`moduleLoaderFetch` uses plain `fopen`/`fread` as a stand-in; the real
version should call through this instead, per the plan in `MODULES.md`.

**D.2** **Fold the verified `GlobalObject`/`GlobalObjectMethodTable` mechanism
into `jsc-lo/main.cc`**, replacing `JSGlobalContextCreate(NULL)` +
`JSEvaluateScript` with the custom global object +
`loadAndEvaluateModule` + `.then()` handlers + `vm.drainMicrotasks()`
pattern the experiment already proved out.

**D.3** **Decide where the existing `console`/`runtime` (`print`, `get_address`,
`args`) globals setup moves to** once `main.cc` constructs a custom
`JSGlobalObject` subclass instead of a bare one.

**D.4** **Set `machExceptionHandlerSandboxPolicy = Allow` and
`Options::useSharedArrayBuffer() = true` in `jsc-lo`'s real startup**,
mirroring what `jsc.cpp` itself does — confirmed via source (see
`API.md`'s updated JSC `SharedArrayBuffer` section) that this is a clean,
one-line opt-in with no browser-security ceremony involved for a
non-browser embedder.

**D.5** **Investigate/implement dynamic `import()` support.**
`moduleLoaderImportModule` is left `nullptr` in the experiment —
untested, not unsupported; static `import` was the only thing verified.

## E. Engine portability — binding ABI

A separate, complementary effort: getting bindings (`curl`, `sqlite`, the
FFI machinery, ...) off direct `v8::`/`lo::` C++ calls and onto a small,
stable `extern "C"` boundary, so a binding compiled once keeps working
against any engine backend. Source: [`ABI.md`](ABI.md).

**E.1** ~~Decide Option 1 vs. Option 2 for how functions get registered.~~
**Resolved: Option 1** — same decision as `WORK.A.1`, see there for the
`lo_abi.h` sketch this produced.
[`ABI.md` § "The open question"](ABI.md#the-open-question-how-functions-actually-get-registered).

**E.2** **Prototype Option 1 against one real binding** (`epoll` suggested —
small, self-contained) **and benchmark it against today's codegen'd
version** before committing to a full migration — explicitly called out
as needed rather than assumed, since the generic-dispatch-loop perf cost
vs. per-function-JIT mitigation is unmeasured. `lo_abi.h` sketches the
*shape* of the descriptor/dispatch mechanism but doesn't implement a real
dispatcher (interpreted or JIT'd) or generate a table from `lib/gen.js` —
this item is still that follow-through work, now against a concrete
header instead of a paragraph in `ABI.md`.
[`ABI.md` § "Where this leaves it"](ABI.md#where-this-leaves-it).

**E.3** **Enumerate the exact accessor list for every `lo_type_t`** (only an
illustrative subset exists in the sketch today).

**E.4** **Design the ABI versioning/negotiation story** — a version field the
loader checks before calling `lo_register_*`, most likely; needed before
this ships, not designed yet.

**E.5** **Plan the migration/porting of `core`'s FFI preamble
(`bind_fastcall`/`bind_slowcall`/`SlowCallback`/`CTypeFromV8`) onto
whichever option is picked** — nontrivial since it's the mechanism
everything else in `ABI.md` leans on; deserves its own pass once Option
1 vs. 2 (`WORK.E.1`) is decided.

**E.6** **Windows dynamic-addon-loading story** — no analog to
`-bundle_loader`/`-rdynamic` currently exists for the Windows build;
out of scope for `ABI.md`'s own pass, not designed anywhere yet.

**E.7** *(Smaller, noted in the review but not the ABI doc itself)*
**de-duplicate `lib/core2/api.js`'s near-verbatim copy of `core`'s FFI
preamble** for the Windows build — flagged in passing in
[`CODE_REVIEW.md` § "Not reviewed in this pass"](CODE_REVIEW.md#not-reviewed-in-this-pass).

## F. Build system & binary size

Source: [`PROPOSAL.md`](PROPOSAL.md), [`BUILD.md`](BUILD.md).

**F.1** **Land an `EXPORTS` Makefile variable (`full`/`abi`/`none`)** controlling
how many symbols the final binary exports — `full` is today's behavior,
default, no change; `abi` restricts exports to the curated `lo_*` ABI
surface (`-exported_symbols_list`/`--dynamic-list` depending on
platform); `none` exports nothing, for a fully static build that never
loads `lo`-API-aware addons. Measured baseline: ~16% of the current
32.5 MiB binary is export-table overhead, almost entirely V8's own
~28k mangled C++ symbols leaking through because the prebuilt archive
wasn't compiled hidden-by-default.
[`PROPOSAL.md` § "Proposed model: three export modes"](PROPOSAL.md#proposed-model-three-export-modes).

**F.2** **Generate `lo.exports` (macOS) / `lo.dynsym` (Linux) from one canonical
source** (e.g. a marker alongside `DLL_PUBLIC` in `lo.h`) instead of two
hand-maintained lists that can drift out of sync.

**F.3** ~~Land the local, from-source V8 build~~ **Done and verified working**,
in the sibling `../v8` repo (its own project — `v8-macos-build`, not the
abandoned-looking `scratch/v8-14.7`/`scratch/v8_old`/`scratch/v8_old2`
left in *this* tree, which predate it). `v8-14.7/out.gn/arm64.release/`
has a built `v8_monolith` + `d8`; `build.sh`'s own smoke test (linking
`test.cc` against the monolith) passes. **Not yet done**: actually
wiring `lo`'s own `Makefile` to link against this instead of the
downloaded `just-js/v8` release — still a real, unstarted task, now that
the thing it would link against exists. Two wrinkles for whoever does
that wiring, found by reading `../v8/build.sh`'s link step directly:
  - `../v8/args.mac.arm64.gn` has `v8_enable_temporal_support=true`, which
    pulls in Rust (`temporal_capi`/`temporal_rs`) — linking against this
    monolith means also bundling a set of `.rlib` files from the Rust
    sysroot (`build.sh` discovers them by globbing
    `third_party/rust`/`build/rust/allocator`/the rustc sysroot lib dir),
    not just `-lv8_monolith`. If `lo` doesn't need `Temporal`, turning
    that flag off would remove this whole dependency instead of porting
    the Rust-linking step into `lo`'s `Makefile`.
  - Version bump: `../v8` builds **14.7**; `lo`'s `Makefile` currently
    pins `V8_VERSION=14.3` for the downloaded release.
[`PROPOSAL.md` § "V8 build control changes the assessment"](PROPOSAL.md#v8-build-control-changes-the-assessment).

**F.4** **Compile V8 itself with `-fvisibility=hidden`.** Confirmed **not yet
done** in `../v8`'s current `args.mac.arm64.gn` — only `test.cc`'s own
translation unit is compiled with hidden visibility in `build.sh`, V8's
own GN args have no `-fvisibility=hidden` in `extra_cflags`. Still fully
open; the ~28k currently-exported V8 symbols would shrink to V8's own
intentional `V8_EXPORT` embedder surface once this lands.

**F.5** **Compile V8 with `-ffunction-sections -fdata-sections`.** Also
confirmed **not present** in `../v8`'s current GN args — still open, so
`--gc-sections`/`-dead_strip` still can't drop unused V8 internals at
function granularity (today's downloaded archive has one `__text`
section per translation unit, and the local build hasn't changed that
yet either).

**F.6** **Follow-up proposal: trim V8 via its own GN feature flags.** i18n/ICU
is still explicitly on (`v8_enable_i18n_support=true` in
`../v8/args.mac.arm64.gn`); WebAssembly/inspector/devtools flags aren't
addressed at all in that args file either — all still open, and still
flagged as likely the single biggest size lever available, bigger than
the export-table work.

**F.7** **Remove the `-framework CoreFoundation` link dependency.** Comes
entirely from V8's own `platform-darwin.cc` (`CFTimeZoneCopyDefault`/
`CFTimeZoneGetName` for `Intl`/`Date` timezone lookup), not any of
`lo`'s own code. **Confirmed still needed today even with the local
build**: `../v8/build.sh`'s final link line explicitly passes
`-framework CoreFoundation`, because `v8_enable_i18n_support=true` is
still set. Fixable now that the local build exists: either flip that to
`false`, or patch `platform-darwin.cc` to use `readlink /etc/localtime`
instead — genuinely unblocked, not just "unblocked in theory," as of
this local build actually existing.
[`BUILD.md` § "macOS: why we link `-framework CoreFoundation`"](BUILD.md#macos-why-we-link--framework-corefoundation).

**F.8** **Validate `--dynamic-list`/`--exclude-libs,ALL` behavior on a real
Linux build** — currently only reasoned about from `lld` documentation,
never run (this environment is macOS).
[`PROPOSAL.md` § "Validation plan"](PROPOSAL.md#validation-plan-not-run-as-part-of-this-proposal).

**F.9** **Build-matrix check before making `EXPORTS=abi` the default**: confirm
`EXPORTS=abi` against the downloaded prebuilt release (hidden only via
the link-time allow-list) behaves identically to `EXPORTS=abi` against a
locally-built, hidden-by-default V8 — two sources need to agree.

**F.10** **Windows export-control story** — `__declspec` equivalent of the
macOS/Linux mechanisms above, not designed yet.
[`PROPOSAL.md` § "Open questions / risks"](PROPOSAL.md#open-questions--risks).

## G. Related, in-flight, not covered further here

**G.1** **Embedding `lo` as a native Node.js addon** (`bindings/addon.cc`,
`bindings/gen-addon.js`) — the mirror-image integration to everything
above: instead of `lo` replacing Node, Node gets to `require()` `lo`'s
core/FFI/syscall/JIT machinery. Actively in progress per the most recent
commits, and orthogonal to the multi-engine/ABI work — it doesn't block or
get blocked by anything in this list. Described, not prescribed, in
[`SUMMARY.md` § "Currently in progress: embedding `lo` inside Node.js"](SUMMARY.md#currently-in-progress-embedding-lo-inside-nodejs).
