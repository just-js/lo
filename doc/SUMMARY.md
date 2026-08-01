# `lo`: a bare-metal JavaScript runtime built directly on V8

`lo` ([just-js/lo](https://github.com/just-js/lo)) is a small, systems-oriented
JavaScript runtime. It embeds V8 the way Node.js does, but skips almost
everything Node builds on top of V8 — no libuv, no N-API layer by default, no
large standard library baked into the binary's execution path. Instead it
gives JavaScript code near-direct access to `mmap`, `epoll`/`kqueue`,
`dlopen`, raw pointers, and self-modifying machine code, while keeping V8's
JIT and its [Fast API Calls](https://v8.dev/blog/fast-api-calls) mechanism in
the loop wherever it matters for throughput. If you think of V8 as a JIT
compiler with a JS front end attached, `lo` is what you get when you build a
runtime around *that* framing rather than around "a browser engine, minus the
browser."

This document is a tour of how it's put together, aimed at readers who are
comfortable in C/C++ and want to understand the runtime/engine-level
mechanics rather than the JS APIs.

## The shape of the binary

A `lo` executable is a single static-ish binary: V8's monolithic static
library (`v8/libv8_monolith.a`, prebuilt and fetched by the
[`Makefile`](../Makefile)), a handful of C++ "binding" object files, and the
entire JS standard library baked in as linked-in data.

Startup is deliberately tiny — [`main.cc`](../main.cc):

```cpp
int main(int argc, char** argv) {
  uint64_t starttime = lo::hrtime();
  setvbuf(stdout, nullptr, _IONBF, 0);
  setvbuf(stderr, nullptr, _IONBF, 0);
  lo::Setup(&argc, argv, v8flags, _v8_threads, _v8flags_from_commandline);
  register_builtins();
  lo::CreateIsolate(argc, argv, main_js, main_js_len, index_js, index_js_len,
    0, 0, 0, starttime, RUNTIME, "main.js", _v8_cleanup, _on_exit, nullptr);
  lo_shutdown(_v8_cleanup);
  return 0;
}
```

`lo::Setup` and `lo::CreateIsolate` (declared in [`lo.h`](../lo.h#L129-L142),
implemented in [`lo.cc`](../lo.cc)) initialize V8's platform and spin up a
single `v8::Isolate`, then evaluate [`main.js`](../main.js) as the bootstrap
module. Everything else — `console`, `TextEncoder`, module loading,
`setTimeout`, the CLI subcommands — is defined in that one JS file
([`main.js`](../main.js#L1-L37)), which is itself compiled into the binary
rather than read from disk.

### Builtins: source files linked in as `.incbin` data

Rather than shipping a `lib/` directory of `.js` files next to the
executable (or a `zip`/snapshot blob), `lo` links every builtin JS/text
asset directly into the object file using GNU assembler `.incbin`
directives, generated per-platform into
[`builtins_linux.S`](../builtins_linux.S) / [`builtins.S`](../builtins.S):

```asm
.global _binary_main_js_start
_binary_main_js_start:
        .incbin "main.js"
        .global _binary_main_js_end
_binary_main_js_end:
```

The [`Makefile`](../Makefile#L87-L92) assembles this into `builtins.o`, and
[`main.h`](../main.h) declares the resulting symbols as `extern char[]` pairs
whose byte range (`_end - _start`) becomes the length. `register_builtins()`
then calls `lo::builtins_add(name, ptr, len)` (declared in
[`lo.h`](../lo.h#L126-L127)) for each one, populating an in-memory
`std::map<std::string, lo::builtin*>` ([`lo.cc:69`](../lo.cc#L69)) that the
module loader consults before ever touching the filesystem. This is the same
technique linkers use to embed resources (cf. `objcopy --add-section` /
`ld -r -b binary`) — no custom snapshot format, no runtime unpacking step,
just symbols resolved at link time. On Windows, where GAS `.incbin` isn't
available, the same data is instead baked into a generated
[`builtins.h`](../builtins.h) as byte arrays.

The [`runtime/`](../runtime/README.md) directory holds *build configs*
(`core`, `base`, `lo`, `zero`) that select which subset of bindings and JS
modules get linked in — `lo build runtime runtime/zero` produces a minimal
statically-linked binary, `lo build runtime runtime/lo` produces the "batteries
included" build. This is effectively a mechanism for producing
purpose-built, minimal-surface-area binaries rather than one runtime that
loads everything lazily.

## Talking to V8 without the JS↔C++ tax

The most interesting engineering in this codebase is about minimizing the
cost of the boundary between JS and native code, at three different levels.

### 1. Fast API Calls for hot native functions

For functions expected to be called in a loop (`read`, `write`, `hrtime`,
UTF-8 encode/decode, `dlopen`/`dlsym`, `mmap`, ...), `lo` uses V8's
[Fast API Calls](https://v8.dev/blog/fast-api-calls) feature: a
`v8::CFunction` with a `v8::CFunctionInfo` describing the C ABI signature is
registered alongside a normal (slow) `FunctionCallbackInfo`-based callback.
When TurboFan can prove the call site is monomorphic and the arguments match,
it emits a direct call into the C function, bypassing `Isolate` marshaling
almost entirely; otherwise it falls back to the slow path. See
[`lo.cc`](../lo.cc#L73-L101) for the `CTypeInfo`/`CFunctionInfo`/`CFunction`
scaffolding around `hrtime`, and
[`lib/core/core.cc:2667-2695`](../lib/core/core.cc#L2667) for ~30 syscalls
(`open`, `read`, `stat`, `mkdir`, ...) each registered via `SET_FAST_METHOD`
(defined in [`lo.h`](../lo.h#L118-L122)) with both a fast and slow
implementation.

Because Fast API Calls can't safely return 64-bit values or heap pointers
directly to JS (`Number` only has 53 bits of integer precision), `lo`'s
convention for anything pointer-sized is to write the result into a
caller-supplied `Uint32Array` "handle" (two 32-bit words) and reassemble it
in JS — see `addr()` and `get_address()` in
[`main.js:98-100`](../main.js#L98-L100) and `wrap()` at
[`main.js:68-83`](../main.js#L68-L83), which generates a small wrapper function
per bound native call. This is the same
[low/high-word split](https://v8.dev/docs/embed) trick embedders use
whenever a 64-bit quantity has to cross into a `double`-based value
representation.

### 2. Code generation from declarative API descriptions

The V8-facing C++ glue (the `CTypeInfo` arrays, `SET_FAST_METHOD` calls,
slow-path argument unwrapping) is not hand-written per binding. Each binding
module ships a plain JS description of its native API in an `api.js` file,
and [`lib/gen.js`](../lib/gen.js) — itself a builtin, invocable as `lo gen` —
walks that description and emits the corresponding `.cc` file (e.g.
`lib/epoll/epoll.cc`, generated with the header
`// [do not edit,<auto-generated />]` visible at the top of
[`lib/epoll/epoll.cc`](../lib/epoll/epoll.cc#L1-L4)). `getType`/`getFastType`
in [`lib/gen.js:7-55`](../lib/gen.js#L7-L55) map a small set of ABI-ish type
tags (`i32`, `u64`, `pointer`, `buffer`, `string`, ...) to both the C++
parameter type and the corresponding `CTypeInfo::Type` enumerator. This
turns "add a fast native binding" into a data-entry problem instead of a
V8-API problem — useful given how much boilerplate V8's Fast API surface
requires, and how much it has changed across V8 versions.

### 3. A JIT'd, hand-written FFI: `lib/ffi.js` + `lib/asm/*`

For calling into **arbitrary shared libraries** (`dlopen`'d `.so`/`.dylib`
files, not just code compiled into the runtime), there's no way to
pre-generate V8 `CFunction` glue at build time — the target address and
signature are only known at runtime. `lo` solves this by writing its own
tiny x64/arm64 assembler in JavaScript
([`lib/asm/x64.js`](../lib/asm/x64.js), [`lib/asm/arm64.js`](../lib/asm/arm64.js))
and using it to **JIT trampolines on the fly**:

- [`lib/asm/compiler.js`](../lib/asm/compiler.js) is the "linker": it takes a
  byte buffer of machine code, `mmap`s an anonymous `PROT_WRITE` page,
  `memcpy`s the bytes in, then `mprotect`s the page to `PROT_EXEC | PROT_READ`
  — the classic [W^X](https://en.wikipedia.org/wiki/W%5EX) JIT pattern also
  used by V8, LuaJIT, and JS engines generally.
- [`lib/ffi.js`](../lib/ffi.js)'s `compile_fastcall` /`compile_slowcall`
  (x64: [`lib/ffi.js:64-235`](../lib/ffi.js#L64-L235), arm64:
  [`lib/ffi.js:237-294`](../lib/ffi.js#L237-L294)) emit shuffle code that maps
  a `struct fastcall` argument block into the target platform's calling
  convention (System V AMD64 / AAPCS64 registers, stack spill for >6 args),
  then `call`/`br` straight into the resolved `dlsym` address.
- `bind()` ([`lib/ffi.js:316-352`](../lib/ffi.js#L316-L352)) ties this to V8's
  Fast API mechanism again: it fills in a `struct fastcall` (documented at
  [`lib/ffi.js:1-41`](../lib/ffi.js#L1-L41)) with the JIT'd fast/slow function
  pointers and hands it to `core.bind_fastcall`/`core.bind_slowcall`
  (native-side dispatch in `lib/core/core.cc`), so a `dlsym`-resolved C
  function ends up callable from JS through the *same* fast-call path as a
  builtin. `generate_callback()`
  ([`lib/ffi.js:209-232`](../lib/ffi.js#L209-L232)) does the mirror image —
  JIT-generating a trampoline so a **native C library can call back into a
  JS function**, used for C callback-based APIs (see `test()` taking a
  function pointer in [`sum.c`](../sum.c)).

  A minimal end-to-end example of this exists in the working tree right now:
  [`sum.c`](../sum.c) is a trivial shared library (`sum`, plus a `test`
  function that invokes a caller-supplied callback), and
  [`test-ffi.js`](../test-ffi.js) / [`test.js`... `syscalls.js`](../syscalls.js)
  `dlopen` it and benchmark calling into it through `bind()`, including a
  direct fast-vs-slow-path comparison (`bind(..., true)` forces the slow,
  `FunctionCallbackInfo`-based path for comparison).

This is a real, working alternative to the usual "N-API + prebuilt bindings"
or "ffi-napi" story: no native module needs to be compiled per FFI call
target, because `lo` compiles the glue itself, at runtime, per call
signature.

## Memory and syscalls as first-class JS values

`lo`'s C bindings ([`lib/core/core.cc`](../lib/core/core.cc), ~2900 lines) expose
raw POSIX/libc surface directly to JS: `mmap`, `mprotect`, `malloc`/`free`,
`memcpy`, `open`/`read`/`write`/`fstat`/`readdir`, `dlopen`/`dlsym`,
`fork`/`exec`, etc., each wired up as both a slow and (where it matters) fast
call as described above. `WrapMemory`/`UnWrapMemory`
([`lo.h:170-172`](../lo.h#L170-L172)) let a raw pointer be viewed as a
`Uint8Array`/`ArrayBuffer` backed by *externally-owned* memory (an
[`ArrayBuffer::Allocator`](https://v8docs.nodesource.com/node-13.2/d3/d99/classv8_1_1_array_buffer_1_1_allocator.html)
concern for embedders), which is how syscall buffers and `dlopen`'d struct
memory get typed-array views without a copy.

On top of that, per-OS event loop backends —
[`lib/loop.js`](../lib/loop.js) picks between a `kqueue`-based `MacLoop`
([`lib/loop.js:73-175`](../lib/loop.js#L73-L175)) and an `epoll`-based
`UnixLoop` ([`lib/loop.js:209-305`](../lib/loop.js#L209-L305)) — implement
`setTimeout`/`setInterval`/async I/O without libuv. It's a much smaller
event loop than libuv's (no built-in thread pool abstraction, no
cross-platform IOCP/epoll/kqueue unification layer), which is consistent
with the project's general trade-off: less abstraction, more direct mapping
to what the OS actually exposes, at the cost of needing separate code paths
per platform (there's a `main_win.h` for the (partial) Windows target too).

## Build system as part of the runtime

Unusually, the build pipeline for *other* `lo` programs is itself
implemented in `lo` — `lo build runtime <config>` and `lo gen` are
JS-implemented CLI subcommands ([`main.js:628-657`](../main.js#L628-L657))
that shell out to `cc`/`clang` and re-link a new binary with a chosen set of
builtins and bindings baked in. This means "building a smaller/custom
runtime" is a first-class, scriptable operation rather than a fixed set of
`Makefile` targets — the [`Makefile`](../Makefile) itself only builds the
*bootstrap* `lo` binary needed to run that build tooling in the first place.

## Currently in progress: embedding `lo` inside Node.js

The most recent commits (`chore: node bindings...`, `chore: node addon
codegen working`, `chore: add lib/fs.js to node addon`) and the working tree
right now (`bindings/`) are building the mirror-image integration: instead
of `lo` replacing Node, [`bindings/addon.cc`](../bindings/addon.cc) packages
`lo`'s core as a **native Node.js addon** (`NODE_MODULE(...)`), so Node code
can `require()` in `lo`'s `core`/`ffi`/syscall/asm-JIT machinery from inside
a normal Node.js process. It links in a subset of the same `.incbin`-style
builtins (`lib/ffi.js`, `lib/asm.js`, `lib/asm/x64.js`,
`lib/asm/compiler.js`, `lib/fs.js`, ...) and re-registers the same native
modules (`core`, `boringssl`, `ada`, `curl`, `heap`, `md4c`, `python`,
`luajit`) against V8 the way the standalone runtime does.
[`bindings/gen-addon.js`](../bindings/gen-addon.js) generates `addon.cc` and
the corresponding `.S`/object-copy plumbing from the same builtins list, and
`bindings/package.json`'s `install` script runs it before `node-gyp
rebuild`. Practically, this means the JIT'd FFI mechanism described above —
`dlopen` + on-the-fly x64/arm64 trampoline generation via V8 Fast API Calls —
becomes usable as a low-overhead FFI layer *for Node.js itself*, as an
alternative to N-API-based FFI bindings.

## Why this design, in one sentence

Most of the unusual choices here — linking JS source in as object-file data
instead of a snapshot, hand-rolling an x64/arm64 JIT assembler in JS instead
of depending on `libffi`, generating V8's Fast-API C++ glue from declarative
descriptions, writing a from-scratch epoll/kqueue loop instead of using
libuv — are the same choice made repeatedly: prefer a direct, inspectable
path to the OS/ABI over a general-purpose abstraction layer, even when that
means re-implementing something a well-known dependency already provides.
That trade-off is exactly what makes the codebase interesting reading for
anyone curious about what V8 exposes to an embedder once you stop treating
it as "the thing behind Node" and start treating it as a JIT you control
directly.

## Reference links

- [V8 Fast API Calls (v8.dev blog)](https://v8.dev/blog/fast-api-calls) — the mechanism behind `SET_FAST_METHOD` and `lib/ffi.js`'s `bind()`.
- [Embedder's Guide to V8](https://v8.dev/docs/embed) — background on `Isolate`/`Context`/`ArrayBuffer::Allocator` concepts used throughout `lo.cc`/`lo.h`.
- [W^X (Wikipedia)](https://en.wikipedia.org/wiki/W%5EX) — the `mmap`+`mprotect` pattern in `lib/asm/compiler.js`.
- [System V AMD64 calling convention](https://gitlab.com/x86-psABIs/x86-64-ABI) — the register layout `compile_fastcall`/`compile_slowcall` implement for x64.
- [ARM64 (AAPCS64) calling convention](https://github.com/ARM-software/abi-aa/blob/main/aapcs64/aapcs64.rst) — same, for the arm64 code path.
- [`.incbin` (GNU `as` documentation)](https://sourceware.org/binutils/docs/as/Incbin.html) — how builtin JS sources are linked into the binary.
- [Node.js N-API / native addons](https://nodejs.org/api/n-api.html) — the conventional alternative to `bindings/addon.cc`'s approach.
- [just-js/v8 releases](https://github.com/just-js/v8/releases) — prebuilt V8 monolith archives the `Makefile` downloads.
