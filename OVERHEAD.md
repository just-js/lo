https://claude.ai/chat/a2ab5c2e-d869-47f6-b699-290963a62d2f

## An

Yes — this is inherent, and it's not really about `FunctionTemplate::New` as a *construction* API (that cost is paid once, at bind time, not per call). What you're actually measuring is the cost of V8's **generic API callback trampoline** — the mechanism *any* function created via `FunctionTemplate` uses when the call doesn't go through the Fast API path. That trampoline does real, unavoidable work that a build-time-compiled builtin (CSA/Torque, or a JS-visible intrinsic) simply doesn't have to do.

**What the generic callback path (`CallApiCallback` builtin) actually does per call:**

1. **Builds an `ExitFrame`.** Since your C++ callback is opaque to V8 — it could call back into the isolate, trigger GC, throw, allocate — V8 has to record enough frame-walking metadata (PC, FP, frame marker) so the GC and stack unwinder can skip over it safely. Writing/tearing down this frame is real, measurable cost that a fully V8-internal Torque builtin doesn't pay, because the GC already knows exactly how to walk V8-generated code without a frame marker.

2. **Constructs `FunctionCallbackInfo`'s implicit args array** — isolate, holder, data, return-value slot, new_target, etc. — a fixed-layout write of several pointers into a stack area, every call, regardless of what your callback actually uses.

3. **Boxes arguments as `Local<Value>`.** Even though the underlying values may already be primitives in registers, they get handlified — written into the current `HandleScope`'s block — so your callback can safely hold `Local<>`s across allocations. That's pointer writes + handle scope bump-allocation bookkeeping per argument, not just per call.

4. **An indirect function-pointer call across the C++ ABI**, not V8's internal calling convention. V8-generated code uses its own register-based convention tuned for tagged pointers and doesn't set up a standard C stack frame; crossing into real C++ means conforming to the platform ABI (register spills, frame setup) and it's a genuine indirect call the branch predictor treats as a call to unknown code — no inlining across that boundary is possible, ever.

5. **A pending-exception check after the callback returns**, since C++ code has no other way to signal a JS exception.

None of that is optional for a `FunctionTemplate`-backed function — it's not a byproduct of your `Data()` handling, it's the price of the callback being an opaque foreign function at all. A build-time-compiled builtin avoids essentially all of it: it's V8-generated machine code using V8's calling convention, the GC can walk it precisely without an ExitFrame, arguments stay unboxed/untagged in registers, and TurboFan/Maglev can often inline the whole thing directly into the caller.

**The thing that actually gets you close to "compiled in" speed is the Fast API path you already wired up** (`CFunction fastCFunc`) — that's V8's answer to exactly this problem. When the fast call is actually taken, TurboFan emits a direct call to your raw C function with unboxed arguments, no `HandleScope`, no `FunctionCallbackInfo`, no `ExitFrame`. `SlowCallback` only exists as the fallback for when the fast path can't be used (megamorphic call site, args don't typecheck, called via `.apply`/`.call`, not yet optimized, etc.), so if you're benchmarking in a way that never lets the call site warm up (tight loop with no warmup iterations, or invoked once), you're measuring the slow trampoline, not the fast path — and the slow trampoline is the ~2x cost you're describing, inherently.

Worth checking, since it changes what's actually worth optimizing:
- Confirm you're actually hitting the fast path — `%GetOptimizationStatus`/`--trace-turbo-inlining` or just checking call counts in `SlowCallback` (add a counter; if it's nonzero in your hot loop, the fast path isn't engaging).
- Fast calls require the call site to be monomorphic and optimized (Turbofan/Maglev tier) — a handful of warmup iterations are needed before V8 will even attempt it.
- Argument types must exactly satisfy the `CTypeInfo` you built, or it silently falls back to `SlowCallback` for that call.

If your real workload can't guarantee warm, monomorphic call sites (e.g., truly one-off calls), then the 2x you're seeing against a build-time-compiled function is close to the structural floor for the generic embedder callback mechanism — the `External` change we made removes overhead layered *on top* of that floor (object/template allocation, internal-field indirection), but the ExitFrame + boxing + ABI-crossing floor itself doesn't move without engaging the Fast API.


## Qn

this alone adds ~4ns. i assume this is partly the overhead of the lookup itself and partly the fact that v8 cannot inline the function because of this generic lookup?

```C++
struct fastcall* state = static_cast<struct fastcall*>(args.Data().As<v8::External>()->Value(v8::kExternalPointerTypeTagDefault));

```

## An

Half right, but let's separate the two things — they're not the same mechanism, and untangling them tells you what's actually fixable.

**What `External::Value()` costs on its own.** On a sandboxed V8 build (pointer compression / heap sandbox — likely your default unless you've built with it explicitly disabled), an `External` doesn't store the raw pointer inline. It stores an index into the isolate's `ExternalPointerTable`. `Value()` with a tag has to:

1. Load the table's base pointer (isolate-relative load)
2. Index into it with your stored slot index
3. Load the table entry (pointer + encoded tag bits)
4. Check the tag matches what you passed (`kExternalPointerTypeTagDefault`/equivalent) — a type-confusion mitigation
5. Mask off the tag bits and return the raw pointer

That's a load, an indexed load, a compare/branch, and a mask — plus if the external pointer table isn't hot in L1/L2 (plausible if your isolate has many `External`s live), a cache miss. 4ns is very plausible for that on a miss; closer to ~1–1.5ns if it hits cache. On a **non-sandboxed** build this whole thing collapses to a single dereference of a raw pointer stored in the object — no table, no tag check — so if your platform/build allows it and you don't need the sandbox's security properties, that's a real, direct lever here.

**On the inlining question — this is where I'd push back a little.** The C++ compiler (not V8's JIT) almost certainly *does* inline `External::Value()` itself — it's a small header-only method in `v8.h`, and any competent optimizer will eliminate that call overhead. So you're not paying for an uninlined function call on this line; you're paying for the actual memory-access work described above, which can't be inlined away because it's real dereferences, not code.

The inlining loss you're thinking of is happening one level up, and it was already fully priced in before this line ever runs: `SlowCallback` as a whole is never inlined into the JS call site by V8's JIT, because from TurboFan/Maglev's perspective it's an opaque foreign function reached through the `CallApiCallback` trampoline — that's true regardless of what's inside the function body. So this specific line isn't *causing* an inlining loss; it's just additional real work happening inside a call that was already non-inlinable for unrelated reasons (the ExitFrame/ABI-crossing stuff from before).

Net: the 4ns here is ExternalPointerTable indirection + tag-check + possible cache miss, not call/inlining overhead. If you want to actually claw it back:

- **Non-sandboxed build**: collapses to one dereference, cuts most of that 4ns.
- **Stay sandboxed but reduce lookups**: if `state` doesn't change across calls to the same bound function, you're already only paying this once per call — there's no way to cache it across calls without breaking the callback model (V8 gives you no per-call scratch space independent of `Data()`).
- **Skip `External` entirely and go back to Fast API only**: if this pointer is *only* ever needed by `SlowCallback` (the fallback path), and your fast-path C function already gets `state` baked in some other way (e.g. as a compile-time constant per generated trampoline, or via a small dispatch table indexed by an ID passed as a fast-call arg instead of looked up from `Data()`), you avoid this lookup on the hot path altogether and only pay it on the cold fallback — where 4ns is noise.

That last option is probably the highest-leverage move if `SlowCallback` really is your fallback and the Fast API path is meant to carry the load: don't optimize the fallback's constant-lookup cost, make sure the fallback is actually cold.

## Qn

as an embedder of v8 can i create my own CSA/Torque functions, compile them and link them into my runtime without having to recompile the v8 monolithic library i have already built?

## An

No — and the reason is architectural, not a missing flag or an unexported symbol you could work around.

**Torque and CSA aren't an embedder API at all; they're V8's own build pipeline.**

- Torque (`.tq`) files are compiled by the Torque compiler into generated C++ (`gen/torque-generated/*`) as a build step that's wired into V8's own `gn`/`BUILD.gn` graph. That generated C++ gets compiled as part of `v8_base`/`v8_init` — there's no separate output artifact meant to be linked in after the fact by something that isn't V8's own build.
- CSA (`CodeStubAssembler`) is a C++ API, but it lives under `src/`, not `include/v8-*.h`. It requires internal headers and internal types (`Isolate`, `Factory`, `Heap`, `TorqueGeneratedX` classes) that are explicitly not part of V8's stable public surface. Anything built against them has to be compiled *as* V8, in the same translation units, against the same internal ABI — which by definition is a V8 rebuild, not a link-time addition to a prebuilt monolith.
- The deeper blocker: every CSA/Torque builtin is enumerated into a fixed ID space (`BUILTIN_LIST` in `builtins-definitions.h` → `Builtins::Name`) baked in at build time, and the actual generated code is either serialized into the startup snapshot blob or emitted as the "embedded builtins" data section linked into the library. `mksnapshot` runs *during* the V8 build to produce that blob. There is no runtime or link-time registration path for a new entry into that table — the ID space and the blob are closed once V8 is built. This is fundamentally unlike a JIT registering a new compiled function at runtime; CSA builtins are ahead-of-time-compiled as part of V8 itself, which is exactly why they get to skip the ExitFrame/ABI-crossing machinery your `SlowCallback` pays for.

So there's no plugin seam here to exploit — adding a real CSA/Torque builtin means you're maintaining a V8 fork and rebuilding it (which some embedders at that scale, like Node or a browser vendor, genuinely do — but that's "own the V8 build," not "link something extra into a prebuilt monolithic lib").

**What's actually available to you as a pure embedder, in order of how close they get to compiled-in performance:**

1. **Fast API (`CFunction`)** — what you're already using. This is V8's real answer to "I want near-native call performance from JS without forking V8." When the fast path is taken, TurboFan emits a direct call with unboxed args and no trampoline; this is the ceiling for embedder code without a V8 fork.

2. **Snapshot your own JS with `v8::SnapshotCreator`.** If the logic can be expressed in JS rather than C, you can precompile it into a custom startup snapshot — you skip parse/compile cost at startup, and critically, the function is *real* V8-generated code (Ignition → Sparkplug → Maglev/TurboFan as it warms), so it's eligible for inlining by the JIT the way a C++ `FunctionTemplate` callback structurally never is. Not applicable if the logic genuinely has to be native C, but worth knowing it's the one path where "compiled in and inlinable" is achievable without touching V8 internals.

3. **WebAssembly.** The JS↔Wasm calling convention has had more aggressive optimization work put into cross-boundary calls (type-safe by construction, no boxing to `Local<Value>`) than the embedder C++ API trampoline has. If your native function can be compiled to wasm, calls into it from JS can, in practice, get closer to the compiled-in floor than the Fast API in some call shapes — different tradeoff (you lose direct C ABI/pointer access, gain a sandboxed, more inlinable boundary).

4. **Fork and rebuild V8**, if you actually want new CSA/Torque builtins. This is a real, used path at the scale of "we ship our own V8 build" (Node, Deno, browser forks all do variants of this), but it means owning the build and snapshot regeneration going forward, not a one-time link step against your existing prebuilt library.

Given where you already are — Fast API wired up, `External` swapped in for `Data()`, checking that the fast path actually engages — option 1 is very likely already your practical ceiling unless you're prepared to take on a V8 fork.

## Qn

you mentioned the v8 sandbox and/or pointer compression would have an effect cost of External::Value() but you weren't very clear. i have v8 sandbox disable in my v8 monolithic library build but i have enabled pointer compression. does pointer compression on it's own have this overhead in latest v8 (15+) releases?

## An

Good question to pin down precisely — sandbox and pointer compression are separate build flags with separate costs, and conflating them is easy to do since sandbox requires compression as a prerequisite (you can't enable sandbox without compression), which makes it look like they're bundled when they're not. Let me verify against current V8 source rather than go from memory, since the exact gating macros are the kind of thing that shifts between releases.Good catch to push on — I was imprecise. The sources confirm: **pointer compression alone, with sandbox disabled, does not route `External::Value()` through the `ExternalPointerTable`.** That indirection is gated specifically on the sandboxed-external-pointers macro (`V8_SANDBOXED_EXTERNAL_POINTERS`, formerly `V8_HEAP_SANDBOX`), which is tied to `V8_ENABLE_SANDBOX`, not to `V8_COMPRESS_POINTERS`. V8's own decode path makes this explicit — under the sandbox it calls `DecodeExternalPointerImpl(isolate, encoded_pointer, tag)` (table load + tag check); otherwise it's just `return encoded_pointer;` — a raw value, no table, no tag check. V8's sandbox docs back this up directly: the overhead from the sandbox comes mostly from the pointer table indirection for external objects, costing roughly one additional memory load, plus a lesser cost from using offsets instead of raw pointers — that's attributed to the sandbox specifically, not to compression.

So with your actual config (sandbox off, compression on), an `External`'s payload is stored as a raw 64-bit pointer in the object, and `Value()` is just a field load — no isolate-relative table base load, no indexed lookup, no tag mask/compare. Note there is a newer, opt-in mechanism (external pointer table usable under compression without full sandbox) that some V8 versions expose, but it's not the default — you'd have had to explicitly enable it, and given you said sandbox is off, you almost certainly haven't.

**What that means for your 4ns measurement:** it isn't ExternalPointerTable overhead. It's most likely one or some combination of:

- The `Value(kExternalPointerTypeTagDefault)` tag argument you're passing being a no-op in this configuration — the public API signature takes a tag unconditionally (so the same call site compiles for both sandboxed and non-sandboxed builds), but in your build the `#else` branch just ignores it and returns the raw pointer. No extra cost, but also nothing gained by passing it — you could confirm this by checking whether the tagged and untagged overloads generate identical codegen in your build.
- `.As<External>()` doing a debug-mode type check (`CHECK`/`DCHECK` that the `Value` is actually an External) — cheap in release builds but non-zero if any assertions survive into your build config.
- Simple pointer-chasing cost inherent to *any* indirection through `Data()` — you're dereferencing the `FunctionCallbackInfo`'s implicit-args slot to get the `Local<Value>`, then dereferencing that handle to get the heap object, then reading the field. Three dependent loads minimum, none of which V8's sandbox/compression flags change.
- Simply that this load sits inside `SlowCallback`, which — as covered earlier — is never inlined by the JIT into the call site regardless of sandbox/compression settings, so it's paying full uncached-load latency rather than being folded into surrounding code the way a compiled-in access might be.

Pointer compression's actual cost domain is elsewhere: it affects **tagged V8 heap object pointers** (32-bit compressed offsets from an isolate-relative base, decompressed via shift+add on access) — things like `Local<Object>` fields, map pointers, property backing stores. A raw external/native pointer stored via `External` or `SetAlignedPointerInInternalField` was never a compressed tagged pointer to begin with, so compression's decompression cost (cheap — mostly just a shift+add operation per V8's own numbers) doesn't apply to this particular load at all.

If you want to isolate exactly where the 4ns is going, the highest-signal next step is a disassembly/perf check on `SlowCallback` itself (`perf record`/`perf annotate`, or just dumping the generated assembly) rather than reasoning further from the flags — at this granularity you're below the level where the build-flag semantics alone can tell you the answer.

## Qn

how would i do this disassembly check and find that particular call site?

## An

Here's a concrete workflow, roughly in order of effort vs. precision:

**1. Make sure you have symbols and can see source lines**

Build with debug info even in a release/optimized build — `-O2 -g` (don't use `-Og`, you want the real optimized codegen, just with line-table info attached):

```
g++ -O2 -g -fno-omit-frame-pointer -c your_file.cc -o your_file.o
```

`-fno-omit-frame-pointer` matters here — without it, `perf`'s call-graph unwinding and `perf annotate` get much less reliable, especially across the ABI boundary you're trying to inspect.

**2. Find and isolate the symbol**

`SlowCallback` will be name-mangled. Locate it first:

```
nm -C your_binary | grep SlowCallback
```

`-C` demangles. You'll get something like:
```
0000000000123abc t SlowCallback(v8::FunctionCallbackInfo<v8::Value> const&)
```

**3. Static disassembly with source interleaving**

`objdump` with `-S` interleaves source lines with the disassembly for that address range, which lets you find exactly which instructions correspond to your `args.Data().As<External>()->Value(...)` line:

```
objdump -dS --start-address=0x123abc --stop-address=0x123c00 your_binary > slowcallback.asm
```

(pick a `--stop-address` a few hundred bytes past the start — check `nm -S` for the actual symbol size, or just over-shoot and truncate). Search the output for your line's likely source text or for `mov`/`call` sequences right after the function prologue — the `Data()` call, the `As<External>()` check, and the `Value()` field load will all show up as a short run of loads (`mov (%reg), %reg`), not calls, since these are inlined accessors.

If you're on macOS/LLVM toolchain, the equivalent is:
```
llvm-objdump -dS --start-address=... --stop-address=... your_binary
```
which tends to interleave source more reliably than GNU objdump for Clang-compiled code.

**4. Dynamic profiling — this is the one that actually answers "where is the 4ns going"**

Static disassembly tells you *what* runs; it won't tell you *cost*. For that, use `perf` with hardware cycle sampling at instruction granularity:

```
perf record -F max -e cycles:pp --call-graph fp -o perf.data -- ./your_test_binary
perf annotate --stdio SlowCallback
```

`perf annotate` overlays sampled cycle counts onto each disassembled instruction of `SlowCallback`, so you'll see exactly which load/branch is eating the cycles — you're looking for stalls right where the `Data()`/`As<External>()`/`Value()` sequence sits. `-e cycles:pp` (precise, "pp" = precise-with-skid-fix) matters a lot at this granularity; without precise sampling, skid on modern x86 can attribute the cost to the wrong instruction entirely, which would send you chasing the wrong line.

If you want to specifically catch cache misses on that pointer load (which is what a "why is a single field load costing 4ns instead of ~1ns" question usually turns out to be):

```
perf stat -e cycles,instructions,cache-references,cache-misses,mem_load_retired.l3_miss -- ./your_test_binary
```

and/or sample directly on the miss event:

```
perf record -e mem_load_retired.l3_miss -c 1000 --call-graph fp -- ./your_test_binary
perf annotate --stdio SlowCallback
```

(`mem_load_retired.l3_miss` is Intel's PEBS event name; on AMD you'd use something like `ls_dc_accesses`/`ls_l1_d_tlb_miss` — check `perf list` on your machine for the exact available event names, they vary by microarchitecture.)

**5. Isolating just this call site, not the whole function**

Since `SlowCallback` is short, `perf annotate` output for the whole function is usually manageable directly — you don't need to slice it further. But if the function is bigger than expected (e.g., the compiler inlined more surrounding code into it than you assumed), cross-reference against the `objdump -S` output from step 3 to map perf's hot instruction addresses back to the exact source line.

**6. Confirming the tag-argument question directly**

Since one of my hypotheses was that `Value(kExternalPointerTypeTagDefault)` might be a genuine no-op in your build, this is easy to settle without profiling at all — just diff the disassembly of the tagged call against the untagged legacy form (if your V8 header still exposes one) at `-O2`. If both produce byte-identical instruction sequences for the field load, that confirms the tag argument is fully compiled away in your configuration and isn't the source of the 4ns.

One caution before you spend time on this: 4ns is roughly 10–15 cycles on typical desktop clocks — small enough that sampling noise, code alignment (whether the load happens to land across a cache-line/branch-predictor-relevant boundary), and measurement methodology in your own benchmark harness (warmup, whether you're timing includes the `ExitFrame` setup around it) can easily account for a chunk of that delta on their own. Worth checking your benchmark's variance across repeated runs before treating 4ns as a stable, attributable cost to chase further at the instruction level.



```shell
$ nm -C ./lo | grep SlowCallbackI32
000000000365e0c0 t lo::core::SlowCallbackI32(v8::FunctionCallbackInfo<v8::Value> const&)
$ objdump -dS --start-address=0x365e0c0 --stop-address=0x365ffff ./lo > SlowCallback.asm
nm -C ./lo | grep GetFunctionTemplateData
objdump -dS --start-address=0x19b7900 --stop-address=0x19b7fff ./lo > FunctionTemplateData.asm
nm -C ./lo | grep External::Value
objdump -dS --start-address=0x19a8b20 --stop-address=0x19a8fff ./lo > ExternalValue.asm
```


## Qn

here's what i get:


```asm
000000000365e0c0 <_ZN2lo4core15SlowCallbackI32ERKN2v820FunctionCallbackInfoINS1_5ValueEEE>:
void lo_fastcall (struct fastcall* state) {
  ((lo_fast_call)state->fn)(&state->args);
}

// a native call is ~9 nanos. this is ~15
void SlowCallbackI32(const FunctionCallbackInfo<Value> &args) {
 365e0c0:	55                   	push   %rbp
 365e0c1:	48 89 e5             	mov    %rsp,%rbp
 365e0c4:	41 56                	push   %r14
 365e0c6:	53                   	push   %rbx
 365e0c7:	48 89 fb             	mov    %rdi,%rbx
  return Undefined(GetIsolate());
}

template <typename T>
Local<Value> FunctionCallbackInfo<T>::Data() const {
  auto target = Local<v8::Data>::FromSlot(&values_[kTargetIndex]);
 365e0ca:	48 8d 77 40          	lea    0x40(%rdi),%rsi
  return api_internal::GetFunctionTemplateData(GetIsolate(), target);
}

template <typename T>
Isolate* FunctionCallbackInfo<T>::GetIsolate() const {
  return reinterpret_cast<Isolate*>(values_[kIsolateIndex]);
 365e0ce:	48 8b 7f 28          	mov    0x28(%rdi),%rdi
  return api_internal::GetFunctionTemplateData(GetIsolate(), target);
 365e0d2:	e8 29 98 35 fe       	call   19b7900 <_ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE>
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-variable"
  // 3-4 nanos
  struct fastcall* state = static_cast<struct fastcall*>(args.Data().As<v8::External>()->Value(v8::kExternalPointerTypeTagDefault));  
 365e0d7:	48 89 c7             	mov    %rax,%rdi
 365e0da:	31 f6                	xor    %esi,%esi
 365e0dc:	e8 3f aa 34 fe       	call   19a8b20 <_ZNK2v88External5ValueEt>
 365e0e1:	49 89 c6             	mov    %rax,%r14
  ((lo_fast_call)state->fn)(&state->args);
 365e0e4:	48 8d 78 28          	lea    0x28(%rax),%rdi
 365e0e8:	ff 90 28 01 00 00    	call   *0x128(%rax)
#pragma GCC diagnostic pop
  // 2-3 nanos
  lo_fastcall(state);
  args.GetReturnValue().Set((int32_t)state->args[0]);
 365e0ee:	49 8b 76 28          	mov    0x28(%r14),%rsi
                                               std::is_signed_v<T>>* = nullptr>
  V8_INLINE static constexpr bool IsValidSmi(T value) {
    // Is value in range [kSmiMinValue, kSmiMaxValue].
    // Use unsigned operations in order to avoid undefined behaviour in case of
    // signed integer overflow.
    return (static_cast<uintptr_t>(value) -
 365e0f2:	48 63 c6             	movslq %esi,%rax
 365e0f5:	48 05 00 00 00 40    	add    $0x40000000,%rax
            static_cast<uintptr_t>(kSmiMinValue)) <=
 365e0fb:	48 3d ff ff ff 7f    	cmp    $0x7fffffff,%rax
  if (const auto result = internal::Internals::TryIntegralToSmi(i)) {
 365e101:	77 0a                	ja     365e10d <_ZN2lo4core15SlowCallbackI32ERKN2v820FunctionCallbackInfoINS1_5ValueEEE+0x4d>
 365e103:	48 c1 e6 20          	shl    $0x20,%rsi
 365e107:	48 c1 fe 1f          	sar    $0x1f,%rsi
 365e10b:	eb 0c                	jmp    365e119 <_ZN2lo4core15SlowCallbackI32ERKN2v820FunctionCallbackInfoINS1_5ValueEEE+0x59>
  return *reinterpret_cast<Isolate**>(&value_[kIsolateValueIndex]);
 365e10d:	48 8b 7b 28          	mov    0x28(%rbx),%rdi
  SetNonEmpty(Integer::New(GetIsolate(), i));
 365e111:	e8 6a 38 35 fe       	call   19b1980 <_ZN2v87Integer3NewEPNS_7IsolateEi>
      : location_(location) {}

  // Returns the address of the actual heap object (tagged).
  // This method must be called only if the handle is not empty, otherwise it
  // will crash.
  V8_INLINE internal::Address ptr() const { return *location_; }
 365e116:	48 8b 30             	mov    (%rax),%rsi
 365e119:	48 89 73 30          	mov    %rsi,0x30(%rbx)
//  args.GetReturnValue().Set(1);
}
 365e11d:	5b                   	pop    %rbx
 365e11e:	41 5e                	pop    %r14
 365e120:	5d                   	pop    %rbp
 365e121:	c3                   	ret
 365e122:	66 66 66 66 66 2e 0f 	data16 data16 data16 data16 cs nopw 0x0(%rax,%rax,1)
 365e129:	1f 84 00 00 00 00 00 

```

## An

This disassembly is much more informative than the flags analysis — and it overturns part of what I said earlier. Neither `Data()` nor `External::Value()` is inlined here. Both are genuine out-of-line `call` instructions:

```
call 19b7900 <api_internal::GetFunctionTemplateData(Isolate*, Local<Data>)>
...
call 19a8b20 <v8::External::Value(unsigned short) const>
```

That's the real story. It's not ExternalPointerTable indirection (confirmed — you're not sandboxed), and it's not primarily a cache-miss story either. It's **two actual cross-boundary function calls** that the compiler had no ability to inline, because you're linking against a prebuilt monolithic V8 library rather than compiling against inline-visible definitions in a unified LTO build. Each call pays: `call` + callee prologue (`push`/`mov` setup) + whatever the body does + epilogue + `ret`, plus consuming a return-stack-buffer slot for prediction, plus you can't fold register allocation across the boundary the way you could with an inlined load. Two such calls back-to-back landing in the 3–4ns range is entirely consistent with call/ret overhead alone, before even considering what's inside them.

**Why `Data()` isn't just a slot read anymore.** In older V8 this really was `return Local<Value>(values_[kDataIndex])` — a trivial inlined load, matching what I described originally. What you're seeing — `Data()` delegating to `GetFunctionTemplateData(isolate, target)` — reflects that in current V8, the callback's data isn't just stored raw in the implicit args slot; it's retrieved indirectly through the `FunctionTemplateInfo`, likely because V8 now supports per-context materialization/caching of that data rather than a fixed value baked in at template-creation time. That's real, non-trivial logic living in the library, not a header-inlined accessor — so no build flag on your side changes that; it's inherent to calling `Data()` at all in this V8 version, regardless of whether the payload is an `External`, an `Object`, or anything else. The earlier `SetAlignedPointerInInternalField` version was paying this exact same `Data()` call cost — we just hadn't profiled it at instruction level then, so it was invisible next to the object/internal-field overhead we were focused on.

**Why `External::Value()` isn't inlined despite being trivial internally.** Its actual logic (`return encoded_pointer` in your non-sandboxed config) is genuinely almost free — but the definition itself apparently lives in a `.cc` compiled into the monolithic library, not the header, so your embedder TU only sees a declaration. Without LTO spanning your object files and the V8 static library, the compiler cannot see through that call no matter how trivial the body is.

**To confirm this precisely, disassemble the two callees themselves** — they're already linked into your binary, so you don't need the library sources:

```
objdump -dS --start-address=0x19b7900 --stop-address=0x19b7960 your_binary   # GetFunctionTemplateData
objdump -dS --start-address=0x19a8b20 --stop-address=0x19a8b60 your_binary   # External::Value
```

If `External::Value` disassembles to a handful of instructions (load, mask, ret), that confirms the call/ret overhead is effectively the *entire* cost of that call — nothing left to optimize inside it, only the boundary itself. If `GetFunctionTemplateData` is longer — branches, another load, maybe a check on the target's type — that's real engine-side work you're paying per invocation, independent of anything in your code.

**Practical implication.** This overhead is structurally tied to using `Data()` on a `FunctionTemplate` callback at all, in this V8 version, against a prebuilt monolithic library — swapping representations (External vs. Object vs. anything else) doesn't avoid the `Data()` call, only what happens after it. The two realistic levers left are:

1. **Build V8 with LTO and compile your embedder TUs as part of the same LTO unit**, if your build system allows it — this is the only way to actually eliminate the call boundary for both functions, since it lets the linker inline across the static-library boundary. Substantial build-complexity cost for a few ns, so only worth it if this call site is genuinely hot at your call volumes.
2. **Avoid hitting `SlowCallback` at all** by making sure the Fast API path is engaging for your real workload — since this whole call chain only runs on the fallback path, and its cost is close to fixed regardless of further micro-optimization here.

## Qn

is this what you are looing for?


```asm
00000000019b7900 <_ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE>:
 19b7900:	55                   	push   %rbp
 19b7901:	48 89 e5             	mov    %rsp,%rbp
 19b7904:	48 8b 16             	mov    (%rsi),%rdx
 19b7907:	f6 c2 01             	test   $0x1,%dl
 19b790a:	0f 84 93 00 00 00    	je     19b79a3 <_ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE+0xa3>
 19b7910:	8b 4a ff             	mov    -0x1(%rdx),%ecx
 19b7913:	48 8d 05 ee a6 f9 01 	lea    0x1f9a6ee(%rip),%rax        # 3952008 <_ZN2v88internal8MainCage5base_E>
 19b791a:	81 f9 29 1f 00 00    	cmp    $0x1f29,%ecx
 19b7920:	75 26                	jne    19b7948 <_ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE+0x48>
 19b7922:	8b 72 2b             	mov    0x2b(%rdx),%esi
 19b7925:	48 0b 30             	or     (%rax),%rsi
 19b7928:	48 8b 87 28 02 00 00 	mov    0x228(%rdi),%rax
 19b792f:	48 3b 87 30 02 00 00 	cmp    0x230(%rdi),%rax
 19b7936:	74 64                	je     19b799c <_ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE+0x9c>
 19b7938:	48 8d 48 08          	lea    0x8(%rax),%rcx
 19b793c:	48 89 8f 28 02 00 00 	mov    %rcx,0x228(%rdi)
 19b7943:	48 89 30             	mov    %rsi,(%rax)
 19b7946:	5d                   	pop    %rbp
 19b7947:	c3                   	ret
 19b7948:	48 8b 08             	mov    (%rax),%rcx
 19b794b:	8b 72 ff             	mov    -0x1(%rdx),%esi
 19b794e:	0f b7 74 31 07       	movzwl 0x7(%rcx,%rsi,1),%esi
 19b7953:	81 c6 f0 f7 ff ff    	add    $0xfffff7f0,%esi
 19b7959:	66 83 fe 11          	cmp    $0x11,%si
 19b795d:	77 44                	ja     19b79a3 <_ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE+0xa3>
 19b795f:	8b 52 0f             	mov    0xf(%rdx),%edx
 19b7962:	8b 74 11 07          	mov    0x7(%rcx,%rdx,1),%esi
 19b7966:	40 f6 c6 01          	test   $0x1,%sil
 19b796a:	74 37                	je     19b79a3 <_ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE+0xa3>
 19b796c:	4c 8b 00             	mov    (%rax),%r8
 19b796f:	41 8b 74 30 ff       	mov    -0x1(%r8,%rsi,1),%esi
 19b7974:	81 fe 29 1f 00 00    	cmp    $0x1f29,%esi
 19b797a:	75 27                	jne    19b79a3 <_ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE+0xa3>
 19b797c:	48 09 d1             	or     %rdx,%rcx
 19b797f:	8b 49 07             	mov    0x7(%rcx),%ecx
 19b7982:	48 8b 10             	mov    (%rax),%rdx
 19b7985:	8b 74 0a 2b          	mov    0x2b(%rdx,%rcx,1),%esi
 19b7989:	48 0b 30             	or     (%rax),%rsi
 19b798c:	48 8b 87 28 02 00 00 	mov    0x228(%rdi),%rax
 19b7993:	48 3b 87 30 02 00 00 	cmp    0x230(%rdi),%rax
 19b799a:	75 9c                	jne    19b7938 <_ZN2v812api_internal23GetFunctionTemplateDataEPNS_7IsolateENS_5LocalINS_4DataEEE+0x38>
 19b799c:	e8 ff a2 18 00       	call   1b41ca0 <_ZN2v88internal11HandleScope21ExtendAndCreateHandleEPNS0_7IsolateEm>
 19b79a1:	5d                   	pop    %rbp
 19b79a2:	c3                   	ret
 19b79a3:	48 8d 3d d5 04 8c ff 	lea    -0x73fb2b(%rip),%rdi        # 1277e7f <sqlite3_str_vappendf.zOrd+0x1f082>
 19b79aa:	48 8d 35 f4 04 8c ff 	lea    -0x73fb0c(%rip),%rsi        # 1277ea5 <sqlite3_str_vappendf.zOrd+0x1f0a8>
 19b79b1:	e8 4a 4c fd ff       	call   198c600 <_ZN2v85Utils16ReportApiFailureEPKcS2_>
 19b79b6:	48 8d 3d 14 03 8c ff 	lea    -0x73fcec(%rip),%rdi        # 1277cd1 <sqlite3_str_vappendf.zOrd+0x1eed4>
 19b79bd:	31 c0                	xor    %eax,%eax
 19b79bf:	e8 6c 58 fc ff       	call   197d230 <_Z8V8_FatalPKcz>
 19b79c4:	cc                   	int3
 19b79c5:	cc                   	int3
 19b79c6:	cc                   	int3
 19b79c7:	cc                   	int3
 19b79c8:	cc                   	int3
 19b79c9:	cc                   	int3
 19b79ca:	cc                   	int3
 19b79cb:	cc                   	int3
 19b79cc:	cc                   	int3
 19b79cd:	cc                   	int3
 19b79ce:	cc                   	int3
 19b79cf:	cc                   	int3

```

## An

Yes, exactly what I wanted — and this settles it. `GetFunctionTemplateData` is not a thin accessor; it's doing real, branchy work, and this is very likely where most of your 3-4ns actually goes, not primarily the call/ret boundary.

Walking the fast path:

1. **Tag check** (`test $0x1,%dl` / `je →fail`): confirms the `Local<Data>` handle points to a real HeapObject, not empty/Smi.
2. **Map identity check** (`mov -0x1(%rdx),%ecx` / `cmp $0x1f29` / `jne →slow-unwrap`): reads the object's compressed map word and checks whether the `Data()` payload is directly a `FunctionTemplateInfo` (fast path) or something wrapping/indirecting to one — the `jne` branch at `19b7948` handles the wrapped case with a second map check and an extra pointer chase before rejoining. In your case it's a raw `External`, so you're presumably taking the fast branch, but the branch still has to execute and be predicted.
3. **Pointer decompression** (`mov 0x2b(%rdx),%esi` / `or (%rax),%rsi` against `MainCage::base_`): this is your pointer-compression build in action — the callback-data field is stored as a 32-bit compressed offset and has to be OR'd with the cage base to reconstruct a full pointer. This is exactly the "shift+add"-class cost V8's docs describe as compression's overhead — small, but not zero, and it's happening here.
4. **HandleScope bump allocation** (`mov 0x228(%rdi),%rax` / `cmp 0x230(%rdi),%rax` / `je →ExtendAndCreateHandle`): this is the part I'd flag as the least obvious cost. `Data()` doesn't just decode and return a pointer — it **allocates a new `Local` handle** in the current `HandleScope`'s block on every call: load the block's next-free pointer, compare against the block's limit, and (fast path) bump the pointer and write the decompressed value into the new slot. If the block happens to be full, it falls into `HandleScope::ExtendAndCreateHandle` — a real out-of-line call to grow the handle scope. In steady state you're presumably taking the fast bump-pointer branch, but that's still two loads, a compare, a store, and a second store, all dependent on each other.

So the fast-path cost of `Data()` in this V8 version, on your build, is genuinely: tag check → map check → decompress → handle-scope bump-alloc → return, wrapped in call/ret. That's roughly 10-ish dependent instructions doing real work, not a call to something that's secretly trivial. This is inherent to how `FunctionTemplate` callback data retrieval works in current V8 — every `Data()` call materializes a fresh `Local`, decompressed and handle-allocated, regardless of what the underlying payload type is. Switching between `External`, an `Object` with internal fields, or anything else changes nothing about this cost — it's paid before your code even gets to unwrap the result.

Worth checking `External::Value()` (`19a8b20`) the same way to close the loop — if it's as trivial as expected (load, tag no-op, ret), then you'll have a complete, evidence-based accounting: most of the ~3-4ns is `Data()`'s map-check + decompress + handle-alloc sequence plus two call/ret boundaries, and effectively none of it is `External`-specific.

**Practical takeaway, given this:** there's no representation change on your side that avoids this cost — it's the fixed price of calling `Data()` at all on a `FunctionTemplate` callback in this V8 version. The two levers from before still stand, and now with better justification for the second one: LTO across the V8 static library (removes the call/ret boundary and inlines the whole sequence, but doesn't remove the map-check/decompress/handle-alloc work itself, since that's genuine logic, not overhead), or — much more impactful given what you now know — making sure this code path is cold, since a per-call handle allocation plus compressed-pointer decode is meaningfully more expensive than I'd originally guessed for what looked like "just read `Data()`."


## Qn

```asm
00000000019a8b20 <_ZNK2v88External5ValueEt>:
 19a8b20:	55                   	push   %rbp
 19a8b21:	48 89 e5             	mov    %rsp,%rbp
 19a8b24:	48 89 f8             	mov    %rdi,%rax
 19a8b27:	83 c6 14             	add    $0x14,%esi
 19a8b2a:	66 83 fe 3c          	cmp    $0x3c,%si
 19a8b2e:	73 09                	jae    19a8b39 <_ZNK2v88External5ValueEt+0x19>
 19a8b30:	48 8b 00             	mov    (%rax),%rax
 19a8b33:	48 8b 40 0b          	mov    0xb(%rax),%rax
 19a8b37:	5d                   	pop    %rbp
 19a8b38:	c3                   	ret
 19a8b39:	48 8d 3d 2d 79 8c ff 	lea    -0x7386d3(%rip),%rdi        # 127046d <sqlite3_str_vappendf.zOrd+0x17670>
 19a8b40:	48 8d 35 df d8 8d ff 	lea    -0x722721(%rip),%rsi        # 1286426 <sqlite3_str_vappendf.zOrd+0x2d629>
 19a8b47:	e8 b4 3a fe ff       	call   198c600 <_ZN2v85Utils16ReportApiFailureEPKcS2_>
 19a8b4c:	48 8b 00             	mov    (%rax),%rax
 19a8b4f:	48 8b 40 0b          	mov    0xb(%rax),%rax
 19a8b53:	5d                   	pop    %rbp
 19a8b54:	c3                   	ret
 19a8b55:	cc                   	int3
 19a8b56:	cc                   	int3
 19a8b57:	cc                   	int3
 19a8b58:	cc                   	int3
 19a8b59:	cc                   	int3
 19a8b5a:	cc                   	int3
 19a8b5b:	cc                   	int3
 19a8b5c:	cc                   	int3
 19a8b5d:	cc                   	int3
 19a8b5e:	cc                   	int3
 19a8b5f:	cc                   	int3

```

## An

That closes the loop cleanly and confirms the prediction exactly.

`External::Value()` is genuinely trivial: a tag-range bounds check (`add $0x14,%esi` / `cmp $0x3c,%si` — validating the tag argument falls in some accepted range, taking the slow/fatal path otherwise), then two dependent pointer loads — dereference the `External` object to get its backing storage, then read the raw pointer at offset `0xb`. No cage-base OR, no table indirection, no compression decode. That's the confirmation: on your build (sandbox off), the payload really is stored as a raw 64-bit pointer, and reading it back out costs almost nothing beyond the two dependent loads and the call/ret boundary around them.

**Full accounting, now backed by actual disassembly rather than inference:**

| Step | Cost |
|---|---|
| `Data()` call/ret boundary | fixed call overhead |
| — tag + map check | 1 branch |
| — pointer decompression (cage base OR) | 1 load + 1 OR — genuine pointer-compression cost |
| — HandleScope bump-alloc | 2 loads + compare + 2 stores, dependent chain |
| `External::Value()` call/ret boundary | fixed call overhead |
| — tag bounds check | 1 branch |
| — two dependent loads | the only "real" payload-fetch cost |

So the honest breakdown of your measured 3-4ns: the large majority is `Data()`'s handle-scope allocation and map/tag validation, a small piece is pointer-compression's decompress step, and `External::Value()` itself — the thing we originally set out to optimize by moving off `SetAlignedPointerInInternalField` — was already about as cheap as it can get. The earlier optimization (External over the ObjectTemplate/internal-field approach) was real and worth keeping, but it was never going to move this specific 3-4ns further, because that cost lives almost entirely in `Data()`, which you can't bypass while using `FunctionTemplate`'s `Data` mechanism at all in this V8 version.

That leaves the same two levers as before, but now correctly targeted:

- **LTO across the V8 static library** removes both call/ret boundaries and lets the compiler potentially fold the `Data()` handle-alloc and `External::Value()` load into a single dependent chain with better scheduling — but it does not remove the map-check, decompress, or handle-scope-bump work itself, since none of that is call-overhead, it's logic V8 actually needs to perform. Realistic upside is probably in the 1-2ns range, not the full 3-4ns.
- **Avoid a per-call `Data()` fetch entirely, structurally.** Since the actual cost driver is HandleScope allocation on every single invocation, the biggest win isn't in how you store the pointer — it's in not calling `Data()` from inside `SlowCallback` at all when you can help it. If `state` is invariant per bound function (which it is, from what you've shown), and this genuinely needs to be fast even on the slow-path fallback (not just the Fast API path), the only way to actually eliminate this cost is to stop going through V8's generic `Data()` accessor and instead generate a distinct C++ function per binding at bind time — e.g. a small per-binding trampoline (function pointer or even a tiny JIT'd stub) that has `state` baked in as an immediate/captured constant rather than fetched from `FunctionCallbackInfo` at all. That's a materially larger engineering lift (codegen or a template-per-binding scheme) and only worth it if `SlowCallback` volume is actually significant in your real workload rather than just the Fast API fallback.

Given everything measured here, I'd treat this as the practical floor for "read embedder data from a generic `FunctionTemplate` callback in this V8 version" — further gains require either not doing that (per-binding codegen) or not being in this code path at all (Fast API engaging on the hot path, which was the original recommendation and remains the highest-leverage lever you have).

## Qn

re this: "instead generate a distinct C++ function per binding at bind time — e.g. a small per-binding trampoline (function pointer or even a tiny JIT'd stub) that has `state` baked in as an immediate/captured constant rather than fetched from `FunctionCallbackInfo` at all"

can you show me some example source code of how this work work for the slowcallback case? i'm not sure i fully understand what you are suggesting.

## An

Two different ways to do this, with different tradeoffs. I'll show both since the right one depends on whether you have a bounded number of bindings or need this to scale arbitrarily.

## Option A: compile-time trampoline pool (no codegen, bounded count)

Generate N distinct C++ functions via template instantiation, each backed by its own static storage slot for `state`. Since each instantiation is a genuinely distinct function (distinct address), V8 sees N different `FunctionCallback` pointers — no `Data()` needed at all, because the pointer isn't passed through V8's callback machinery, it's baked into which *function* you handed V8 in the first place.

```cpp
constexpr size_t kMaxBindings = 512; // compile-time bound — pick something safely above your real usage

// One static storage slot per template instantiation.
template <size_t N>
struct BindingSlot {
  static inline struct fastcall* state = nullptr;
};

// The real logic lives in exactly one place, so you don't get N copies of the body —
// only the tiny stub below is duplicated per instantiation.
static void SlowCallbackBody(struct fastcall* state,
                              const FunctionCallbackInfo<Value>& args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  ((lo_fast_call)state->fn)(&state->args);
  lo_fastcall(state);
  args.GetReturnValue().Set((int32_t)state->args[0]);
}

// This is what gets handed to V8 as the FunctionCallback. No args.Data() call —
// just a direct load from a static, then a tail call into the shared body.
template <size_t N>
void SlowCallbackFixed(const FunctionCallbackInfo<Value>& args) {
  SlowCallbackBody(BindingSlot<N>::state, args);
}

// Build a table of N distinct function pointers at compile time.
template <size_t... I>
constexpr auto make_trampolines(std::index_sequence<I...>) {
  return std::array<FunctionCallback, sizeof...(I)>{ &SlowCallbackFixed<I>... };
}
constexpr auto g_trampolines = make_trampolines(std::make_index_sequence<kMaxBindings>{});

// Setting BindingSlot<N>::state for a *runtime-chosen* N needs the same trick —
// an array of setter functions, one per N, built the same way.
using SetterFn = void(*)(struct fastcall*);
template <size_t... I>
constexpr auto make_setters(std::index_sequence<I...>) {
  return std::array<SetterFn, sizeof...(I)>{
    +[](struct fastcall* s){ BindingSlot<I>::state = s; }...
  };
}
constexpr auto g_setters = make_setters(std::make_index_sequence<kMaxBindings>{});

// Your own free-list/bump counter over [0, kMaxBindings).
static size_t g_next_slot = 0;
```

Bind-time usage — replaces your `Data()`-carrying `FunctionTemplate::New` call:

```cpp
void bind_slowcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
      Local<BigInt>::Cast(args[0])->Uint64Value()); // using the BigInt fix from earlier

  size_t slot = g_next_slot++;
  if (slot >= kMaxBindings) { /* handle exhaustion */ }
  g_setters[slot](state);                 // stash state in BindingSlot<slot>

  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(
      isolate,
      g_trampolines[slot],                // <-- distinct function, no Data needed
      Local<Value>(),                     // Data left empty — nothing to fetch
      Local<v8::Signature>(),
      0,
      v8::ConstructorBehavior::kThrow,
      v8::SideEffectType::kHasNoSideEffect,
      0);

  Local<Function> fun = funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}
```

What this buys you: the callback body now reads `state` via `BindingSlot<N>::state` — a plain static-storage load, resolved at a fixed address (RIP-relative on x86-64), no tag check, no compressed-pointer decode, no HandleScope bump-allocation, no call/ret boundary for the fetch at all. That entire `Data()` + `External::Value()` cost — the whole thing we just spent several messages measuring — is gone.

The catch: `kMaxBindings` is a hard compile-time ceiling, and each instantiation costs a small amount of code size (though the shared-body trick above keeps each stub to a handful of instructions, so N=512 is cheap). If your binding count is genuinely unbounded or very large, this doesn't fit.

## Option B: real per-binding JIT stub (unbounded, x86-64 only, heavier)

This is what "tiny JIT'd stub" actually means literally: at bind time, you emit a few bytes of real machine code into an executable page, with `state` embedded as an immediate. The stub's only job is to inject `state` as a second argument and tail-jump into your shared handler.

```cpp
// Shared handler — note the extra explicit state parameter, no Data() involved.
static void SlowCallbackWithState(const FunctionCallbackInfo<Value>& args_unused,
                                   struct fastcall* state) {
  // never actually called directly by V8 — see stub below for real entry
}

// V8 calls the stub with: rdi = const FunctionCallbackInfo<Value>&
// The stub rewrites this into: rdi = args, rsi = state, then jumps into
// a handler with signature void(const FunctionCallbackInfo<Value>&, struct fastcall*).
extern "C" void SlowCallbackCommon(const FunctionCallbackInfo<Value>& args,
                                    struct fastcall* state) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  ((lo_fast_call)state->fn)(&state->args);
  lo_fastcall(state);
  args.GetReturnValue().Set((int32_t)state->args[0]);
}

FunctionCallback make_stub(struct fastcall* state) {
  // System V AMD64: movabs $state,%rsi ; movabs $SlowCallbackCommon,%rax ; jmp *%rax
  uint8_t code[] = {
    0x48, 0xBE,                                     // movabs $imm64, %rsi
    0,0,0,0,0,0,0,0,                                // <state, patched below>
    0x48, 0xB8,                                     // movabs $imm64, %rax
    0,0,0,0,0,0,0,0,                                // <SlowCallbackCommon, patched below>
    0xFF, 0xE0                                       // jmp *%rax
  };
  memcpy(code + 2,  &state, 8);
  void* target = reinterpret_cast<void*>(&SlowCallbackCommon);
  memcpy(code + 12, &target, 8);

  size_t page = sysconf(_SC_PAGESIZE);
  void* mem = mmap(nullptr, page, PROT_READ | PROT_WRITE,
                    MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
  memcpy(mem, code, sizeof(code));
  mprotect(mem, page, PROT_READ | PROT_EXEC);   // W^X: write phase done, now exec-only

  return reinterpret_cast<FunctionCallback>(mem);
}
```

Bind-time usage is then just `FunctionTemplate::New(isolate, make_stub(state), Local<Value>(), ...)` — no `Data()`, no lookup table, unbounded binding count, `state` genuinely baked in as a machine-code immediate.

**Why I'd steer you toward Option A unless you have a specific reason not to:**

- Option B is ISA-specific (this encoding is x86-64 only — ARM64 needs entirely different bytes) and platform-sensitive: macOS/iOS enforce W^X strictly and may require special JIT entitlements (`MAP_JIT`, `pthread_jit_write_protect_np`) that this snippet doesn't handle; some hardened Linux configs (`vm.mmap_min_addr`, SELinux, exec-shield policies) restrict RWX/executable-anonymous mappings too.
- It's one mmap'd page per binding unless you build your own bump allocator over shared pages (probably worth doing if you go this route, since a bare 4KB page per binding is wasteful).
- It's a genuine attack-surface increase — you're now generating and executing runtime-constructed machine code, which is exactly the kind of thing security review processes flag, and a bug in the stub-generation logic is a memory-corruption bug in the truest sense.
- The performance win over Option A is close to zero — both eliminate the `Data()`/`External::Value()` cost equally well; B just also removes the trampoline table's one extra indirection, which is noise next to what you've already cut.

Option A gets you essentially all of the same benefit with none of the platform/security complexity, at the cost of a compile-time cap you can just set generously.