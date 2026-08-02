# The core `lo` API surfaced to JS

This documents everything [`lo::Init`](../lo.cc#L1464-L1529) registers on the
`lo` global object when an isolate starts up, plus the `extern "C"`
isolate-lifecycle ABI in [`lo.h`](../lo.h#L210-L269) that
[`lib/worker.js`](../lib/worker.js) uses to spin up isolates on other OS
threads. This is the runtime's own primitive surface — not the `core`
binding (`dlopen`/syscalls/etc., a separate module loaded via
`library('core')`, already covered from a different angle in
[`ABI.md`](ABI.md)).

The second half is a portability assessment: which of these are trivially
portable to a JSC or QuickJS backend, which need real rework, and — the
main thing asked for — whether spinning up multiple independent JS VM
instances with shared memory between them, controlled from JS, is feasible
across all three engines, and what changes to `lo`'s current design that
would take.

## API inventory

### Identity / version

| JS | Implementation | Notes |
|---|---|---|
| `lo.version.lo`, `lo.version.v8` | [`Init`](../lo.cc#L1465-L1470) | Static strings (`VERSION`, `V8::GetVersion()`) |
| `lo.arch()` | [`Arch`](../lo.cc#L1381-L1402) | Compile-time `#ifdef` dispatch, no V8 dependency |
| `lo.os()` | [`Os`](../lo.cc#L1368-L1379) | Same |
| `lo.exit(code)` | [`Exit`](../lo.cc#L1404-L1407) | `exit(status)` |

### Timing

| JS | Implementation | Notes |
|---|---|---|
| `lo.hrtime()` | [`HRTime`](../lo.cc#L966-L969) / fast: [`fastHRTime`](../lo.cc#L971-L973) | `clock_gettime(CLOCK_MONOTONIC)` (POSIX) / `QueryPerformanceCounter` (Windows) |

### errno

| JS | Implementation | Notes |
|---|---|---|
| `lo.errno` (accessor) | [`GetErrno`](../lo.cc#L926-L928)/[`fastGetErrno`](../lo.cc#L930-L932), [`SetErrno`](../lo.cc#L934-L936)/[`fastSetErrno`](../lo.cc#L938-L940) | Thread-local libc `errno` |

### Module system

| JS | Implementation | Notes |
|---|---|---|
| `lo.builtins()` | [`Builtins`](../lo.cc#L894-L904) | Lists keys of the global `builtins` map |
| `lo.builtin(name[, asBuffer])` | [`Builtin`](../lo.cc#L696-L716) | Returns linked-in source as a `String` or a zero-copy `SharedArrayBuffer` over it |
| `lo.libraries()` | [`Libraries`](../lo.cc#L906-L916) | Lists keys of the global `modules` map |
| `lo.library(nameOrAddress)` | [`Library`](../lo.cc#L668-L692) | Resolves `_register_<name>` (by name from the `modules` map, or by raw address for `dlsym`'d bindings), calls the returned `Init(Isolate*, Local<ObjectTemplate>)`, returns the resulting exports object |
| `lo.setModuleCallbacks(asyncResolver, syncResolver)` | [`SetModuleCallbacks`](../lo.cc#L918-L923) | Stores JS callbacks in `Context::SetEmbedderData(1/2, ...)` |
| `lo.loadModule(source, path[, cache])` | [`LoadModule`](../lo.cc#L793-L890) | `ScriptCompiler::CompileModule`, records the module in the per-isolate module map |
| `lo.unloadModule(identity)` | [`UnloadModule`](../lo.cc#L786-L791) | Erases from the per-isolate module map |
| `lo.evaluateModule(identity)` | [`EvaluateModule`](../lo.cc#L749-L783) | `InstantiateModule` + `Evaluate` |
| `lo.registerCallback(execInfoPtr, fn, nargs)` | [`RegisterCallback`](../lo.cc#L735-L745) | Stores a `Global<Function>` for later native-triggered invocation (see [Isolate lifecycle](#isolate-lifecycle--cross-thread-callback-abi) below) |

Backed by [`OnModuleInstantiate`](../lo.cc#L367-L384)/[`OnDynamicImport`](../lo.cc#L386-L400), which call back into JS-side resolver functions set via `setModuleCallbacks` — this is what `main.js`'s `on_module_load`/`on_module_instantiate` hook into.

### String encoding

| JS | Implementation | Fast path? |
|---|---|---|
| `lo.latin1Decode(ptr[, len])` | [`Latin1Decode`](../lo.cc#L1201-L1210) | No |
| `lo.utf8Decode(ptr[, len])` | [`Utf8Decode`](../lo.cc#L1189-L1198) | No |
| `lo.utf8Encode(str)` | [`Utf8Encode`](../lo.cc#L1156-L1175) | No |
| `lo.latin1Encode(str)` | [`latin1Encode`](../lo.cc#L1177-L1186) | No |
| `lo.utf8Length(str)` | [`Utf8Length`](../lo.cc#L981-L984) | Yes — [`fastUtf8Length`](../lo.cc#L986-L988) |
| `lo.utf8EncodeInto(str, destPtr)` | [`Utf8EncodeInto`](../lo.cc#L1252-L1266) | Yes — [`fastUtf8EncodeInto`](../lo.cc#L1268-L1272) |
| `lo.utf8EncodeIntoAtOffset(str, destPtr, off)` | [`Utf8EncodeIntoAtOffset`](../lo.cc#L1274-L1285) | Yes — [`fastUtf8EncodeIntoAtOffset`](../lo.cc#L1312-L1317) |

The fast paths take a `struct FastOneByteString* const` ([`lo.h:56-59`](../lo.h#L56-L59)) — a raw `{data, length}` pointer straight into V8's internal one-byte string storage, handed out by V8's Fast API Calls machinery with no copy.

### Raw memory

| JS | Implementation | Fast path? |
|---|---|---|
| `lo.wrapMemory(addr, size[, freeOnGC])` | [`WrapMemory`](../lo.cc#L1097-L1118) | No |
| `lo.wrapMemoryShared(addr, size[, freeOnGC])` | [`WrapMemoryShared`](../lo.cc#L1121-L1142) | No |
| `lo.unwrapMemory(arrayBuffer)` | [`UnWrapMemory`](../lo.cc#L1144-L1148) | No |
| `lo.getAddress(typedArray, outU32x2)` | [`GetAddress`](../lo.cc#L975-L979) | No |
| `lo.readMemory(destAddr, srcAddr, size)` | [`ReadMemory`](../lo.cc#L1063-L1071) | Yes — [`fastReadMemory`](../lo.cc#L1073-L1076) |
| `lo.readMemoryAtOffset(destAddr, srcAddr, size, off)` | [`ReadMemoryAtOffset`](../lo.cc#L1079-L1088) | Yes — [`fastReadMemoryAtOffset`](../lo.cc#L1090-L1094) |
| `lo.isolate_start_address(outU32x2)` | [`GetIsolateStartAddress`](../lo.cc#L1319-L1322) | No — returns `&lo_start_isolate` as a number |

`wrapMemory`/`wrapMemoryShared` build a V8 `ArrayBuffer`/`SharedArrayBuffer` over externally-owned bytes via `ArrayBuffer::NewBackingStore`/`SharedArrayBuffer::NewBackingStore`, optionally calling [`lo::FreeMemory`](../lo.cc#L188-L190) (= `free()`) when the buffer is collected.

### Diagnostics

| JS | Implementation | Notes |
|---|---|---|
| `lo.get_meta(value, outObj)` | [`GetMeta`](../lo.cc#L1021-L1061) | Reports `isOneByte`/`isTwoByte`/`isExternalOneByte` for strings, `isExternal`/`isDetachable`/`isShared` for (Shared)ArrayBuffers/TypedArrays |
| `lo.heap_usage(outBigU64x12)` | [`HeapUsage`](../lo.cc#L1000-L1019) | `Isolate::GetHeapStatistics()`, 12 fields |
| `lo.shm_usage(outBigU64x3)` | [`SharedMemoryUsage`](../lo.cc#L990-L998) | `V8::GetSharedMemoryStatistics()` — V8's read-only heap space |
| `lo.setFlags(str)` | [`SetFlags`](../lo.cc#L1150-L1154) | `V8::SetFlagsFromString` |
| `lo.environ()` | [`EnvironSlow`](../lo.cc#L1433-L1435) | Returns `environ` (libc global) as a number |

### Script execution / event loop

| JS | Implementation | Notes |
|---|---|---|
| `lo.print(str)` | [`Print`](../lo.cc#L1324-L1329) | `fprintf(stdout, ...)` |
| `lo.runScript(source, path)` | [`RunScript`](../lo.cc#L1331-L1366) | Plain (non-module) `Script::Compile`/`Run` |
| `lo.nextTick(fn)` | [`NextTick`](../lo.cc#L731-L733) | `isolate->EnqueueMicrotask(fn)` |
| `lo.runMicroTasks()` | [`RunMicroTasks`](../lo.cc#L718-L723) | `isolate->PerformMicrotaskCheckpoint()` |
| `lo.pumpMessageLoop()` | [`PumpMessageLoop`](../lo.cc#L725-L729) | Currently a no-op stub — not actually implemented |

### Isolate lifecycle & cross-thread callback ABI

Not on the `lo.*` JS namespace directly — resolved via `dlsym` from JS
(see `lib/worker.js`'s `Worker` class) — but this is the mechanism that
actually matters for the question below.

| C symbol | Declared | Notes |
|---|---|---|
| `lo_context_size()` | [`lo.h:240`](../lo.h#L240) | `sizeof(struct isolate_context)` |
| `lo_create_isolate_context(...)` | [`lo.h:241-245`](../lo.h#L241-L245), impl [`lo.cc:1551-1581`](../lo.cc#L1551-L1581) | Deep-copies argv/main/js/globalobj/scriptname into a heap-owned `isolate_context` struct (see [`CODE_REVIEW.md`](CODE_REVIEW.md#1-missing-null-terminator-in-isolate_context-string-copies--real-heap-over-read) for a real bug here) |
| `lo_start_isolate(ctx)` | [`lo.h:246`](../lo.h#L246), impl [`lo.cc:1584-1590`](../lo.cc#L1584-L1590) | Entry point a new OS thread calls; runs `lo_create_isolate` → `lo::CreateIsolate` synchronously on that thread |
| `lo_destroy_isolate_context(ctx)` | [`lo.h:247`](../lo.h#L247), impl [`lo.cc:1592-1606`](../lo.cc#L1592-L1606) | Frees the copied buffers |
| `lo_callback(exec_info*)` | [`lo.h:262`](../lo.h#L262), impl [`lo.cc:1609-1616`](../lo.cc#L1609-L1616) | Calls a stored `Global<Function>`, guarded by `isolate == Isolate::GetCurrent()` — same-thread only |
| `lo_async_callback(exec_info*, callback_state*)` | [`lo.h:263`](../lo.h#L263), impl [`lo.cc:1619-1654`](../lo.cc#L1619-L1654) | Cross-thread request queue (has the `volatile`/non-atomic bug from `CODE_REVIEW.md`) |
| `lo_shutdown(cleanup)` | [`lo.h:265`](../lo.h#L265), impl [`lo.cc:1656-1669`](../lo.cc#L1656-L1669) | `V8::Dispose()`, clears global registries |

`struct isolate_context` ([`lo.h:215-233`](../lo.h#L215-L233)) is plain
POD data — argc/argv, source buffers + explicit lengths, a handful of
flags. `struct exec_info`/`callback_state` ([`lo.h:249-260`](../lo.h#L249-L260))
carry a `v8::Global<v8::Function>` and an `Isolate*` — the only
engine-typed fields in this whole ABI.

## Portability assessment

### The terminology problem, and a proposed fix

"Isolate" is V8's name for "one independent JS heap/VM instance, usable on
one thread at a time." Every engine has the concept, under a different
name and with a slightly different shape:

| Engine | The "one VM instance" unit | Notes |
|---|---|---|
| V8 | `v8::Isolate` (holding one or more `Context`s) | One isolate per thread for true isolation; `Locker`/`Unlocker` exist if you want one isolate shared across threads over time (not `lo`'s current model — `lo` uses one isolate per thread, never shared) |
| JavaScriptCore | `JSContextGroup` + one or more `JSGlobalContextRef`s in it | A group can be used across threads with JSC's own locking if you want a shared heap; separate groups give you V8-isolate-equivalent full isolation |
| QuickJS | `JSRuntime` (holding one or more `JSContext`s, i.e. realms) | Documented as strictly single-thread-at-a-time per runtime, with no built-in locking primitive at all — separate runtimes on separate threads is the only supported multi-thread pattern |

This maps cleanly onto one engine-neutral concept: **one GC heap per OS
thread that wants true isolation, hosting one or more global realms.**
[`ABI.md`](ABI.md) already introduced an opaque `lo_engine_t` for roughly
this — worth formally committing to that as the name (not "isolate," not
"runtime" — `lo` itself is already "the runtime," and reusing the word for
this would be confusing in exactly the way "isolate" is confusing today for
being V8-specific).

### The actual question: is multi-VM-instance-with-shared-memory feasible across all three?

Worth separating two things that get conflated under "isolates":

1. **Can one JS VM instance safely be touched concurrently by multiple
   threads?** — No, on any of the three engines, not without real work.
   V8 needs `Locker`. JSC needs its own group-locking discipline. QuickJS
   has *no* answer to this at all — a `JSRuntime` must only ever be touched
   by the thread that owns it, full stop.
2. **Can multiple, independent VM instances (each on its own thread) share
   access to the same block of raw memory?** — This is what `lo` actually
   does today (`wrapMemory`/`wrapMemoryShared`), and it turns out **not to
   depend on (1) at all.** `lo`'s current model is one isolate per thread,
   never shared across threads — `WrapMemory`/`WrapMemoryShared` don't ask
   V8 to coordinate anything between isolates; they just ask *each*
   isolate, independently, to wrap the *same* externally-owned pointer as
   its own `ArrayBuffer`/`SharedArrayBuffer`. The "sharing" is just two
   independent VMs holding a view over the same OS memory — V8 isn't doing
   anything special to make that possible beyond "let me create a JS object
   over a pointer I don't own."

That second capability — wrap externally-owned bytes as an `ArrayBuffer`
without copying, with a custom free callback — is a completely ordinary
embedder need, and all three engines' public C APIs have a version of it:

- V8: `ArrayBuffer::NewBackingStore(data, length, deleter, deleter_data)` — what `lo` uses today.
- JavaScriptCore: `JSObjectMakeArrayBufferWithBytesNoCopy` (public API, in `JSTypedArray.h`) — takes bytes, length, and a deallocator callback, same shape.
- QuickJS: `JS_NewArrayBuffer(ctx, buf, len, free_func, opaque, is_shared)` — same shape, and it has an explicit `is_shared` flag for the `SharedArrayBuffer`-vs-`ArrayBuffer` class distinction.

**So: yes, this looks feasible in principle** — the "spin up N independent
VM instances, each on its own thread, each wrapping the same raw memory
region as a (Shared)ArrayBuffer, controlled from JS" model that `lo`
already implements for V8 doesn't obviously hit an engine-level wall on
JSC or QuickJS. The parts of today's design that need to change are almost
entirely about *how each backend implements the same JS-facing contract*,
not about the model being unsound.

**Where I'd want more certainty before committing to this, and where your
benchmarks/example code would help**:

- **`Atomics` completeness on QuickJS.** If JS code on two different
  isolates needs to *coordinate* access to shared memory (not just read/
  write it opportunistically), it needs `Atomics.wait`/`notify` — which
  means a real blocking wait tied to actual OS thread primitives, not
  something an engine can fake internally. I'm not confident from memory
  alone how complete `Atomics.wait`/`notify` support is in the specific
  QuickJS fork/version you'd target (this varies between Bellard's
  original QuickJS and forks like quickjs-ng). Worth checking directly
  against whichever one you're building against.
- **JSC's `SharedArrayBuffer`/`Atomics` gating.** Browsers (including
  Safari/WebKit) restricted `SharedArrayBuffer` post-Spectre, later
  reintroducing it behind cross-origin-isolation requirements — but that
  restriction may live in WebKit's browser-facing policy layer rather than
  in JavaScriptCore the engine itself. Embedding JSC directly, outside a
  browser security model, plausibly sidesteps this entirely — worth
  confirming against the specific JSC build/version rather than assuming
  either way. Still open — the module-loading experiment below didn't
  touch `Atomics`/`SharedArrayBuffer`.
- If you've already got example code or benchmarks probing any of this
  (spinning up multiple JSC/QuickJS contexts on separate threads, wrapping
  shared memory, exercising `Atomics`), pointing me at them would let me
  replace "plausibly" above with a real answer.

**Update — JSC module loading, no longer open:** built and ran a standalone
proof of concept against a real JSCOnly WebKit build (see the sibling
`jsc-lo` repo, `doc/MODULES.md`). A custom `JSGlobalObject` subclass
supplying `moduleLoaderResolve`/`moduleLoaderFetch`/
`moduleLoaderCreateImportMetaProperties` via `GlobalObjectMethodTable`,
driving `runtime/Completion.h`'s `loadAndEvaluateModule` +
`vm.drainMicrotasks()` — the same mechanism WebKit's own `jsc` shell uses
— resolved and evaluated a real multi-file `import` graph correctly,
including `import.meta`, with clean promise rejection on missing files or
bare specifiers. Full writeup under "Module loading" in the Tier 2
breakdown below. The remaining open item there is a build/API-stability
tradeoff (JSC's internal C++ API vs. its public framework API), not a
capability gap.

### API-by-API portability tiers

Given the model above is sound in principle, here's how the actual API
surface splits by how much per-engine work each entry needs.

**Tier 1 — trivially portable.** Pure C, or a shape every engine's C API
supports the same way once wrapped: `arch`, `os`, `exit`, `errno`,
`hrtime`, `environ`, `print`, `runScript`, `wrapMemory`/`wrapMemoryShared`/
`unwrapMemory`/`readMemory`/`readMemoryAtOffset`/`getAddress`,
`isolate_start_address`. Each needs a per-engine backend implementation
(V8's `ArrayBuffer::NewBackingStore` vs. JSC's/QuickJS's equivalents above),
but the JS-facing contract doesn't change and no engine lacks the
underlying capability.

**Tier 2 — portable concept, meaningfully different mechanism per engine,
needs a real backend abstraction.**

- *Module loading* (`loadModule`/`unloadModule`/`evaluateModule`/
  `setModuleCallbacks`, and the resolver callbacks): ES modules are a
  language-level spec, but the embedder API for driving compilation/
  instantiation/evaluation differs a lot. QuickJS has a reasonably close
  match (`JS_Eval` with `JS_EVAL_TYPE_MODULE`, `JS_SetModuleLoaderFunc`) —
  arguably a closer conceptual fit to `lo`'s existing specifier-resolver
  callback model than V8's own API.

  **JSC update, verified against a real build** (see the sibling `jsc-lo`
  repo — a from-scratch build of WebKit's JSCOnly port plus
  `doc/MODULES.md` there): the *official public* C API (`JSBase.h`) does
  in fact have **zero** module support — `JSEvaluateScript` has no module
  variant, confirmed by reading `JSBase.h` directly, and the only module
  API that ever existed at the public-API layer (`JSScript`,
  `JSModuleLoaderDelegate`) is gated behind the Objective-C wrapper
  (`JSC_OBJC_API_ENABLED`, Mac/iOS-only, requires Foundation), not the
  plain C API `lo` uses today. So that part of the original assessment
  holds.

  What's new: JSC's **internal C++ engine API**
  (`runtime/Completion.h`'s `loadAndEvaluateModule`, driven by a custom
  `JSGlobalObject` subclass supplying `moduleLoaderResolve`/
  `moduleLoaderFetch`/`moduleLoaderCreateImportMetaProperties` via
  `GlobalObjectMethodTable` — exactly the mechanism WebKit's own `jsc`
  shell uses to implement its `--module` flag) was actually built and run
  as a standalone experiment, not just read about. A ~250-line program
  linked against the same `libJavaScriptCore.a` a `jsc-lo`-style build
  produces resolved and evaluated a real two-file `import` graph,
  populated `import.meta.url`/`import.meta.filename` correctly, and
  rejected missing-file/bare-specifier cases cleanly with real JS error
  values rather than crashing. This is not undocumented-internals hacking
  — it's the same API surface WebKit's own first-party shell is built on,
  `JS_EXPORT_PRIVATE`-exported from the archive `lo` would link against
  regardless.

  **Net effect on the risk**: downgrade from "JSC may lack the capability
  entirely" to "JSC has the capability, but only by linking against JSC's
  internal C++ sources (building JSCOnly from WebKit source, as `jsc-lo`
  does) rather than against a public, framework-only SDK." That's a real
  cost — it means a JSC backend ties `lo`'s build to a WebKit source
  checkout and internal headers that carry no public API-stability
  guarantee across WebKit versions, unlike V8's or QuickJS's public C
  APIs — but it's a build-dependency and stability-surface risk, not a
  missing-capability one. Still real work, still worth flagging, no
  longer the open question it was.
- *Microtask draining* (`nextTick`/`runMicroTasks`): QuickJS has an
  explicit, portable-shaped equivalent (`JS_EnqueueJob`,
  `JS_ExecutePendingJob`/`JS_IsJobPending`). JSC's *public* API doesn't
  give the same explicit control (WebKit drives its own internal run-loop
  integration) — same weak spot as modules at the public-API layer. Also
  confirmed via the same experiment: JSC's internal `vm.drainMicrotasks()`
  is exactly the portable-shaped equivalent QuickJS has, it's just behind
  the same internal-API line as module loading — module evaluation is
  inherently promise-based in JSC (`loadAndEvaluateModule` returns a
  `JSPromise*` even when every fetch resolves synchronously), so a JSC
  backend needs `drainMicrotasks()` regardless of whether microtask
  draining is exposed as its own `lo.*` entry.
- *String fast paths* (`utf8Length`/`utf8EncodeInto`/
  `utf8EncodeIntoAtOffset`'s **fast** variants specifically): these hand
  out a raw pointer into V8's internal one-byte string storage with zero
  copy, via V8's Fast API Calls. Neither JSC nor QuickJS's public API
  exposes a zero-copy pointer into internal string storage this way — both
  require a copy (`JSStringGetUTF8CString`-style / `JS_ToCStringLen2`).
  The **slow** paths (already string-copying, used regardless of engine)
  are portable as-is; the fast, zero-copy ones are a V8-only acceleration
  that should be optional, not part of the guaranteed contract.
- *`registerCallback`/`lo_callback`* (call a stored JS function from native
  code): every engine supports "hold a retained handle to a function value,
  call it later" (JSC: protected `JSObjectRef` + `JSObjectCallAsFunction`;
  QuickJS: `JS_DupValue`-retained value + `JS_Call`) — portable in shape,
  engine-specific in mechanism.
- *`lo_async_callback`'s cross-thread queue*: genuinely engine-agnostic
  already, once its concurrency bug (flagged in `CODE_REVIEW.md`) is fixed
  properly — it never touches the target VM from the wrong thread, it just
  hands off a request for the owning thread to execute later. This part of
  the design doesn't need to change for portability, just for correctness.
- *`builtins`/`builtin`/`libraries`/`library`*: the registries themselves
  are pure C++ data, already engine-neutral. `library`'s actual mechanism —
  resolve `_register_<name>`, call `Init(Isolate*, Local<ObjectTemplate>)`
  — is exactly the entry-point problem [`ABI.md`](ABI.md) already covers;
  no new work here beyond what that doc proposes.

**Tier 3 — engine-specific, no real equivalent, shouldn't be core.**
`heap_usage` (V8's specific `HeapStatistics` field set — other engines have
*some* memory introspection but different shapes; a smaller
lowest-common-denominator subset, e.g. "bytes used"/"bytes allocated",
could be Tier 1, with the rest as extension), `shm_usage` (V8's read-only
heap space is a V8-internal architectural detail with no analog), `setFlags`
(V8's `--flag=value` string DSL has no equivalent runtime-flags-as-a-string
concept on the other two), and the `isOneByte`/`isTwoByte`/
`isExternalOneByte` bits of `get_meta` (V8-specific string representation
internals — the `isExternal`/`isDetachable`/`isShared` ArrayBuffer bits are
more portable, since detachability is now part of the ECMAScript spec
itself). These should live behind an explicit engine-specific namespace
(e.g. `lo.v8.*`) rather than pretending to be universal — the same
treatment [`ABI.md`](ABI.md) already proposed for the `heap` binding's
`v8::HeapProfiler` usage, and directly analogous to how Node.js exposes
`v8`-specific internals behind its own `v8` module rather than folding them
into portable globals.

### What changes `lo`'s own design needs

1. **`lo::CreateIsolate` needs to stop being one 220-line, V8-hardcoded
   function** (already flagged structurally in `CODE_REVIEW.md`, but it's
   now a hard prerequisite, not just a readability nicety): VM creation,
   global/realm setup, module compile, module run, and teardown each need a
   per-engine backend implementation behind a common sequence. Decomposing
   it into named phases is the first real step toward a second backend
   existing at all.
2. **The `isolate_context`/`lo_create_isolate_context`/`lo_start_isolate`
   ABI is already engine-neutral in shape** — plain POD data (argc/argv,
   source buffers + explicit lengths, flags) with a stable C entry point a
   new thread calls. This is good news: this part of the design doesn't
   need rework for portability, just the bug fixes already called out in
   `CODE_REVIEW.md`. `lo_start_isolate`'s internals need to dispatch to
   whichever engine backend the binary was built with, but the ABI it
   presents to JS/`lib/worker.js` doesn't need to change.
3. **Memory wrapping needs one abstraction point**: "wrap `(ptr, len)` as
   a JS (Shared)ArrayBuffer, optionally freeing it via a given deleter on
   collection" becomes one `lo_wrap_memory(engine, ptr, len, shared, free)`
   -shaped ABI entry (per `ABI.md`'s sketch), implemented once per engine
   backend using whichever of the three APIs above applies.
4. **The FFI/JIT trampoline mechanism** (`core`'s `bind_fastcall`/
   `bind_slowcall`, `lib/ffi.js`, `lib/asm/*`) matters more now than it did
   in `ABI.md`'s framing: this is exactly the mechanism that needs to work
   the same way regardless of engine for *any* native function call from
   JS to be portable, and `ABI.md`'s Option 1 (generic descriptor + shared
   trampoline, reusing this exact mechanism) becomes the more clearly
   correct choice once multi-engine is a real, near-term goal rather than a
   future possibility — a second reason (beyond what `ABI.md` already
   argued) to lean that direction.
5. **Fast API Calls (`CFunction`/`CTypeInfo`, `SET_FAST_METHOD`/
   `SET_FAST_PROP`) become an explicitly optional, V8-backend-only
   acceleration** — every `lo.*` entry needs a working non-fast
   implementation as the guaranteed contract, with a fast path as a bonus
   a given engine backend may or may not provide, invisible to callers
   either way.
6. **Module loading and microtask draining need their own backend
   abstraction, prioritized ahead of the memory/threading work** — per the
   tier breakdown above, this is the actual biggest risk area (specifically
   JSC's weaker public API here), not the shared-memory model, which looks
   sound.
7. **Engine choice belongs at build time, one engine per binary** — this
   fits the existing `runtime/*.config.js` pattern (`core`/`base`/`lo`/
   `zero` configs already select which bindings/builtins get linked in)
   directly: add an `ENGINE=v8|jsc|quickjs` axis alongside the existing
   `ARCH`/`os` ones in the `Makefile`, producing a `lo` binary linked
   against one engine, rather than attempting to support multiple engines
   simultaneously inside one process. Nothing in the API surface above
   requires more than that — "portable" here means "the same `lo.*`
   contract works no matter which single engine a given binary was built
   against," not "multiple engines coexist at runtime."

### Bottom line

The core thing asked about — multiple independent JS VM instances, each on
its own thread, sharing access to raw memory, controlled from JS — looks
genuinely feasible on all three engines: the mechanism `lo` already uses
for this (wrap externally-owned bytes as an ArrayBuffer, no copy, per-VM)
isn't V8-specific in capability, just in the exact function names involved.

Module loading and microtask control on JSC — flagged above as the bigger
open risk, more so than the memory-sharing question — has now been
verified rather than inferred: a standalone experiment against a real
JSCOnly WebKit build (`jsc-lo`, sibling repo) resolved, fetched, and
evaluated a real `import` graph, including `import.meta`, using the same
internal `Completion.h`/`GlobalObjectMethodTable` mechanism WebKit's own
`jsc` shell relies on. The risk wasn't imaginary — JSC's *public* C API
genuinely has zero module support, confirmed by reading `JSBase.h`
directly — but the capability exists and works one layer down, at the cost
of building against JSC's internal C++ sources (and their weaker
cross-version API-stability guarantees) rather than a public SDK. That's
the real remaining tradeoff for a JSC backend: a build-dependency and
long-term-maintenance cost, not an open feasibility question.

Still open, and still resting on general knowledge rather than something
verified against this codebase: `Atomics`/`SharedArrayBuffer` completeness
on QuickJS, and whether JSC's `SharedArrayBuffer` gating (post-Spectre,
browser-facing in WebKit) actually reaches a directly-embedded JSC outside
a browser security model. If example code or benchmarks already exist
probing either engine's threading/`Atomics`/context-group behavior, I'd
like to see them — that's the one piece of this assessment the JSC module
experiment didn't touch.
