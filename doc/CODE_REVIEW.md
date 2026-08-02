# Code review: `lo.h` / `lo.cc` / `lib/core/api.js` preamble

Scope, per request: the core runtime — [`lo.h`](../lo.h), [`lo.cc`](../lo.cc),
and the hand-written C++ embedded in [`lib/core/api.js`](../lib/core/api.js)'s
`preamble` (already covered in [`ABI.md`](ABI.md) from a different angle —
this doc is a correctness/robustness pass, that one was about engine
portability). Not in scope: the *generated* `lib/core/core.cc` (bugs there
are bugs in `lib/gen.js`'s template, a separate review), or other bindings.

Findings are ordered by how directly they bear on the two things flagged as
priorities — thread-safety/data-ownership across isolates, and "easier to
reason about" — not by file order. Each one was traced to an actual call
site rather than flagged on inspection alone, so severity reflects what
happens today, not just what looks risky.

## Concurrency / data ownership

### 1. Missing null terminator on worker isolate context strings — real heap over-read

[`lo_create_isolate_context`](../lo.cc#L1551-L1581) builds the per-thread
copy of `argv`, `globalobj`, and `scriptname` like this, three times over:

```cpp
ctx->argv[i] = (char*)calloc(1, strnlen(argv[i], 4096));
memcpy(ctx->argv[i], argv[i], strnlen(argv[i], 4096));
```

`calloc(1, strnlen(s, N))` allocates *exactly* the string's byte length —
zero room for a terminating `\0`. `memcpy` then fills that entire buffer
with non-null bytes. The result is a heap allocation containing string data
with **no null terminator anywhere in it.** Same pattern for `globalobj`
and `scriptname` right below it.

These buffers get read back as C-strings inside
[`lo::CreateIsolate`](../lo.cc#L434):

- `argv[i]` — `strlen(argv[i])` at [`lo.cc:505`](../lo.cc#L505), **unbounded**.
  This will read past the allocation until it happens to hit a zero byte
  somewhere in adjacent heap memory — anything from a wrong string length
  to a crash.
- `globalobj` — `strnlen(globalobj, 256)` at [`lo.cc:547`](../lo.cc#L547),
  `scriptname` — `strnlen(scriptname, 1024)` at [`lo.cc:555`](../lo.cc#L555).
  Bounded, so less severe, but still a heap-buffer-overflow read past the
  actual allocation (would flag under ASan).

This is exercised by real, active code, not a dead path:
[`lib/worker.js`](../lib/worker.js)'s `Worker` class calls
`isolate_context_create` (bound in [`lib/core/api.js:387-397`](../lib/core/api.js#L387-L397))
to spin up an isolate on a new OS thread — this is *the* worker-thread
mechanism.

**Why this hasn't shown up in testing**: `calloc` zero-fills its entire
allocation, and on a lot of common allocator states the bytes immediately
following a fresh small allocation are also zero (untouched pages, adjacent
freed-and-cleared chunks) — so `strnlen`/`strlen` often "happen" to stop
close to the right place. That's the profile of a bug that passes ad hoc
testing and breaks under a different heap layout, a longer argument list,
or ASan/valgrind.

**Fix**: allocate `len + 1` at all three sites (or, better, replace the
three subtly-duplicated calloc+memcpy sequences with one small `dupstr()`
helper so this can't be gotten wrong in only one of the three spots next
time).

### 2. Per-isolate module map stored as a pointer to a stack-local — dangles before disposal

Inside [`lo::CreateIsolate`](../lo.cc#L434), [`lo.cc:487-488`](../lo.cc#L487-L488):

```cpp
std::map<int, Global<Module>> module_map;
isolate->SetData(0, &module_map);
```

`module_map` is a local variable of the block that also runs
`Context::New`, module compilation, and `module->Evaluate`. That block
closes at [`lo.cc:645`](../lo.cc#L645) (`module_map` destructed there).
`cleanupIsolate(isolate)` — which calls `ContextDisposedNotification()`,
`ClearKeptObjects()`, `Dispose()` — runs *after* that, at
[`lo.cc:649`](../lo.cc#L649), with `isolate->GetData(0)` now a dangling
pointer.

This works today only because nothing during `Dispose()` happens to
dereference embedder data slot 0. That's incidental, not designed in: any
future V8 version, any weak-callback/finalizer path that walks embedder
data during teardown, or any future extension of `cleanupIsolate` itself,
turns this into a live use-after-free. `EvaluateModule`
([`lo.cc:754`](../lo.cc#L754)) and `UnloadModule`
([`lo.cc:789`](../lo.cc#L789)) both retrieve this same pointer via
`isolate->GetData(0)` mid-execution, so the pattern is depended on
elsewhere too — worth fixing at the source rather than patching each call
site.

**Fix**: heap-allocate `module_map` (or wrap it in something whose lifetime
is explicitly tied to the isolate, e.g. freed in `cleanupIsolate` itself)
so its lifetime isn't accidentally borrowed from a lexical scope that
happens, today, to enclose every current use.

### 3. Global `builtins`/`modules` maps: unsynchronized by convention, and cleanup leaks every entry

[`lo.cc:69-70`](../lo.cc#L69-L70):

```cpp
std::map<std::string, lo::builtin*> builtins;
std::map<std::string, lo::register_plugin> modules;
```

Plain global `std::map`s, no mutex, no `const`, no comment documenting a
thread-safety contract. In practice this is safe *today* because every
write (`builtins_add`/`modules_add`) happens once, at process startup
(`register_builtins()`, called before any isolate or thread exists — traced
through `main.cc` and `bindings/addon.cc`), and everything afterward is
read-only lookups (`lo::Builtin`/`Builtins`/`Library`/`Libraries`),
including from worker-isolate threads spawned later.

That invariant is real, but it's enforced entirely by convention and call
order — nothing in the code says so, and nothing would catch a future
"register a binding lazily on first use" feature quietly turning this into
a genuine data race between a writer and concurrent worker-thread readers.
Worth at minimum a comment at the declaration; ideally something that makes
violating the assumption loud (a "frozen after startup" flag checked in
`builtins_add`/`modules_add`, or moving to an immutable structure built
once and only ever read after).

**Separately, a concrete bug**: [`lo_shutdown`](../lo.cc#L1656)
([`lo.cc:1667-1668`](../lo.cc#L1667-L1668)) does
`builtins.clear(); modules.clear();`. `clear()` destroys the map's own
nodes but the map's value type is a raw `lo::builtin*`
([`builtins_add`](../lo.cc#L176-L182) does `new builtin()`,
[`lo.cc:178`](../lo.cc#L178)) — `clear()` never calls `delete` on what those
pointers point to. Every builtin ever registered leaks on shutdown. This
directly contradicts the comment immediately above the `cleanup` parameter
("clean up memory left behind... if you want to spawn multiple isolates in
the same process without memory leaks").

**Fix**: `std::map<std::string, std::unique_ptr<lo::builtin>>` so `clear()`
frees automatically, or an explicit delete loop before `clear()`.

### 4. `volatile int` used as a cross-thread counter — doesn't do what it looks like it does

[`lo.h:256-260`](../lo.h#L256-L260):

```cpp
struct callback_state {
  volatile int current = 0;
  int max_contexts = 0;
  exec_info** contexts;
};
```

used in [`lo_async_callback`](../lo.cc#L1619-L1654), whose own comment
says: *"trampoline callback which may be called async from another
thread."*

`volatile` in C++ — unlike Java or C# — gives no atomicity and no
cross-thread memory-ordering guarantee. It only prevents the compiler from
caching that one variable in a register or reordering accesses to it
*within a single thread*. Treating `volatile` as a substitute for
synchronization is one of the most common C++ concurrency
misconceptions, and this is that pattern.

Even granting atomic access to `current`, the actual operation
([`lo.cc:1635-1638`](../lo.cc#L1635-L1638)) is a multi-step
read-then-write sequence:

```cpp
state->contexts[state->current] = (struct exec_info*)calloc(1, size);
memcpy((void*)state->contexts[state->current], (void*)info, size);
state->current = (state->current + 1) % state->max_contexts;
```

Two threads calling this concurrently can both read the same `current`,
both write `contexts[current]` (one write silently lost), and both compute
the same next value. `std::atomic<int>` alone would fix the counter's own
read/write but not this — the invariant that actually needs protecting
spans the counter *and* the array slot together, which needs either a real
mutex around the whole sequence or a properly-designed lock-free ring
buffer (bounded SPSC/MPSC, with atomic head/tail) — not a bigger `volatile`.

### 5. Global `random_fd` opened lazily with no synchronization

[`lo.cc:64`](../lo.cc#L64), [`lo.cc:1419-1431`](../lo.cc#L1419-L1431)
(`EntropySource`):

```cpp
int random_fd = -1;
...
if (random_fd == -1) random_fd = open("/dev/urandom", O_RDONLY);
```

`V8::SetEntropySource(EntropySource)` is registered once, globally, in
[`lo::Setup`](../lo.cc#L1437-L1462) — but worth confirming (not verified in
this pass) whether the callback itself is only ever invoked once during
process-wide `V8::Initialize()`, or can be invoked again per-isolate
(including isolates created on worker threads via `lo_start_isolate`) for
hash-seed/RNG purposes. If the latter, this lazy-init is a textbook
double-checked-init race: two threads can both observe `-1`, both `open()`,
one fd leaks, and the two threads proceed believing in different values of
a variable that's supposed to be a single global. Cheap to fix regardless
of which is true: initialize `random_fd` eagerly inside `lo::Setup` (which
runs once, single-threaded, before any isolate exists) instead of lazily
inside a callback that isolate creation triggers.

## Correctness / robustness

### 6. `WrapMemory`/`WrapMemoryShared`'s free-on-GC path assumes every wrapped pointer came from `malloc`

[`lo::WrapMemory`/`WrapMemoryShared`](../lo.cc#L1097-L1142),
[`lo::FreeMemory`](../lo.cc#L188-L190) (`= free(buf)`). The `free_memory`
flag gives JS exactly one deletion strategy for externally-wrapped
memory — libc `free()` — with no way to express "this came from `mmap`,
unmap it instead" or "this is borrowed, someone else owns it, never free
it." This codebase hands JS raw pointers to `mmap`'d, executable JIT
buffers elsewhere (see [`lib/asm/compiler.js`](../lib/asm/compiler.js)'s
`Compiler.compile()`) — wrapping one of those with `free_memory=1` would
call `free()` on memory that didn't come from `malloc`, which is undefined
behavior and will typically corrupt the allocator's own metadata. Nothing
in `WrapMemory`'s signature or the pointer it's given carries any
provenance information to catch this.

`WrapMemoryShared` sharpens the problem: two isolates on different threads
can each wrap the *same* external address independently — nothing tracks
aliasing — so one side's GC-triggered `free()` can run while the other
still holds a live pointer into now-freed memory.

This is flagged as a design gap worth deciding on deliberately, not
necessarily as "wrong" — a runtime whose whole point is giving JS raw
memory access is inherently trusting JS with memory safety (see the closing
section below). But right now there's no comment anywhere establishing who
owns a wrapped buffer, which makes it easy to add a plausible-sounding
feature that introduces a real use-after-free/double-free.

### 7. Inconsistent error propagation between structurally similar functions

[`lo::LoadModule`](../lo.cc#L793-L890) checks
`try_catch.HasCaught()`/calls `try_catch.ReThrow()` on failure, correctly
surfacing a catchable JS exception. [`lo::EvaluateModule`](../lo.cc#L749-L783)
does not: on `InstantiateModule` failure it does
`printf("\nCan't instantiate module.\n"); return;`
([`lo.cc:762-764`](../lo.cc#L762-L764)), and similarly on `Evaluate`
failure ([`lo.cc:774-776`](../lo.cc#L774-L776)) — no exception thrown or
rethrown either time. A JS caller of `evaluateModule` that hits either
failure path silently gets `undefined` back instead of a catchable error,
while the equivalent failure in `loadModule` throws correctly. This kind of
inconsistency is precisely what makes native code hard to reason about from
the JS side — you can't tell which calls might silently no-op versus throw
without reading the C++ each time. Worth picking one convention (throw, via
`try_catch.ReThrow()` where V8 already caught something, or an explicit
`isolate->ThrowException(...)`) and applying it uniformly.

## Structural / readability

### 8. `lo::CreateIsolate` is one ~220-line function doing everything

[`lo.cc:434-656`](../lo.cc#L434-L656) — isolate creation, global/context
setup, script compilation, module instantiation, evaluation, the
`onExit` callback, and cleanup, all inline, with several nested scope
blocks whose exact boundaries matter (see finding #2 above — that bug is
precisely a scope-boundary problem in this function). Not urgent on its
own, but splitting distinct phases into named functions would make lifetime
boundaries like `module_map`'s visible at a glance instead of requiring a
careful brace-count read to find them.

### 9. A lot of commented-out / superseded code left inline

E.g. [`lo.cc:580-593`](../lo.cc#L580-L593) (alternate `CompileModule` calls),
[`lo.cc:604-613`](../lo.cc#L604-L613) (commented-out code-cache write),
[`lo.cc:1211-1251`](../lo.cc#L1211-L1251) (two superseded
`Utf8EncodeInto` implementations), plus scattered single-line alternatives
throughout `CreateIsolate` and `Init`. Doesn't affect correctness, but this
is already a git repository — exploratory/superseded code is better
tracked in history or a branch than left commented inline, where it makes
it genuinely harder to tell what's live without git-blame archaeology.
Worth a pass to delete, or convert to a `// TODO:` note stating what's
blocked and why, wherever the intent is still worth keeping.

### 10. Minor: 56 file-scope `using v8::X;` declarations

[`lo.cc:4-59`](../lo.cc#L4-L59). Not wrong, just a wide net for one
translation unit — everything in that list is implicitly in scope for the
entire file. Low priority; mentioned for completeness, not worth spending
effort on ahead of the findings above.

## On "rely on C++ features as little as possible"

Worth being direct about this, since it was raised as an explicit goal: the
code is already close to it. There's minimal template use beyond
`std::map`/`std::unique_ptr`/`std::string`, no inheritance hierarchies of
`lo`'s own design, no exceptions used for `lo`'s own control flow (only
V8's `TryCatch`, which is unavoidable — it's V8's error model, not a choice
made here), and ownership is almost entirely manual (`new`/`malloc`/
`calloc`/`free`) rather than RAII-heavy. That's a consistently-applied
style, not an accident, and it doesn't need walking back.

What's actually going wrong in findings #1-#5 isn't "too much C++" — it's
manual, C-style lifetime and threading management applied *inconsistently*:
some string copies remember the `+1` for a null terminator, others don't;
some shared state has a comment about its threading assumptions, most
doesn't; `volatile` was reached for where `std::atomic` (or a real lock)
was needed, and reads similarly but isn't. None of the fixes above require
adopting heavier modern-C++ idioms — they're all "still feels like C, just
made correct":

- `std::atomic<int>` instead of `volatile int` for a shared counter is the
  same mental model with correct semantics, not added complexity.
- `std::unique_ptr<builtin>` as a map value (instead of a raw `builtin*`)
  only changes who calls `delete` — no inheritance, no virtual dispatch, no
  RAII sprawl elsewhere.
- One small `dupstr()` helper removes an entire class of
  missing-null-terminator bugs from having three independent chances to get
  it wrong.

So the recommendation isn't "add more C++" — it's that the handful of
places already doing manual memory/threading work by hand need to do it
uniformly and defensively, which is a smaller, more mechanical change than
a redesign.

## Not reviewed in this pass

- Generated [`lib/core/core.cc`](../lib/core/core.cc) — it's
  [`lib/gen.js`](../lib/gen.js)'s template output; bugs there belong to the
  template, not to hand-written code, and are a separate review.
- Other bindings' `preamble` blocks (`core2`, `libffi`, `heap` — same
  category of hand-written C++ as `core`'s, not reviewed here).
  [`lib/core2/api.js`](../lib/core2/api.js) in particular looks like it
  duplicates `core`'s FFI preamble (`bind_fastcall`/`bind_slowcall`/
  `SlowCallback`/`CTypeFromV8`) almost verbatim for the Windows build —
  worth deduplicating regardless of anything else in this review.
- [`lib/asm/*`](../lib/asm) (the x64/arm64 JIT assembler) and
  [`lib/ffi.js`](../lib/ffi.js) — read for context in earlier work this
  session, not reviewed line-by-line here.
