# Proposal: optional/minimal symbol exports and smaller static builds

## Goal

Give `make ... lo` a way to produce a smaller binary by controlling how many
symbols the final executable exports, and make "fully static, no dynamic
addon loading" a real build mode that exports (almost) nothing. This is
written against the plan to introduce a small, stable, `extern "C"` ABI that
addons/bindings call instead of touching `v8::`/`lo::` C++ symbols directly.

This proposal covers **build-system mechanics only** — the Makefile/linker
side of controlling exports, and the three build modes that fall out of it.
It does not attempt to design the ABI's function surface; it assumes the
`extern "C"` block already in [`lo.h`](../lo.h#L235-L265)
(`lo_create_isolate`, `lo_context_size`, `lo_start_isolate`, `lo_callback`,
`lo_shutdown`, ...) is the seed of that future ABI, and that more functions
will be added to it as bindings are migrated off direct `v8::` calls.

## Current baseline (measured)

Numbers below are from the `arm64`/macOS binary already in this tree
(`ls -la lo` → 34,044,208 bytes), inspected read-only with `nm`/`otool` —
no build was run to gather these.

```
$ size lo
__TEXT: 26,574,848   __DATA_CONST: 557,056   __DATA: 131,072   ...

$ otool -l lo | grep -A3 LC_SYMTAB
nsyms 35935   strsize 3,166,200

$ otool -l lo | grep -A2 LC_DYLD_EXPORTS_TRIE
datasize 1,848,104

$ nm -gU lo | wc -l          # defined external (exported) symbols
35564

$ nm -gU lo | grep -c _ZN2v8  # how many are V8 C++ symbols
28242

$ nm -gU lo | grep -c _ZN2lo  # how many are lo:: C++ symbols
12
```

So: of ~35.9k exported symbols, ~28.2k (79%) are V8's own mangled C++ API
(things like `v8::Int32Array::New(...)`, template instantiations of
`v8::internal::Tagged<...>`, etc.) — not anything `lo` itself calls
cross-module, but symbols that are simply *available* because `lo`
addon-loading currently requires them to be.

The export machinery (symbol table string data + the Mach-O export trie
used for `dlsym`/bundle-loader resolution) accounts for roughly **5.3 MB of
the 6.78 MB `__LINKEDIT` segment** — strtab (3.02 MB) + exports trie
(1.76 MB) + symtab entries (0.55 MB) — which is **~16% of the whole 32.5 MiB
binary**, almost entirely attributable to those ~28k V8 symbols (their
mangled names are long: template-heavy C++ averages ~89 bytes/name here).
That's the concrete number this proposal is chasing: cutting exports from
~36k down to a small curated ABI (a few dozen symbols) should remove most of
that 5.3 MB, i.e. get close to a 15% binary size reduction *before* any
dead-code stripping is considered.

## Why symbols are exported today, per platform

`lo`'s own translation units are already compiled with `-fvisibility=hidden`
([`Makefile`](../Makefile#L5-L6), `CCARGS`/`CARGS`), so only symbols
explicitly marked `DLL_PUBLIC` (`__attribute__((visibility("default")))`,
[`lo.h:17-22`](../lo.h#L17-L22)) leak out of `lo.cc`/`main.cc`/`core.cc`
etc. That list is currently ~20 functions (`Setup`, `CreateIsolate`,
`SET_METHOD`/`SET_FAST_METHOD`/..., plus the `extern "C"` block) — small.

**V8's own object files are not compiled with hidden visibility** (they're
consumed as a prebuilt archive, `v8/libv8_monolith.a`, downloaded from
[`just-js/v8` releases](https://github.com/just-js/v8/releases) — we don't
control their compile flags). `-fvisibility=hidden` on *our* command line
has no effect on symbols already baked into that archive with default
visibility. That's the real source of the ~28k exported V8 symbols: nothing
in `lo` chose to export them, they simply weren't hidden at the point they
were compiled, and nothing at link time currently tells the linker to hide
them either.

What actually causes them to end up in the *final executable's* export
table differs by OS, and this matters for the fix:

- **Linux**: ELF executables export nothing to `.dynsym` by default beyond
  what's needed to satisfy shared-library dependencies. `LARGS=-rdynamic`
  ([`Makefile:4`](../Makefile#L4)) explicitly asks the linker to add *all*
  global symbols to the dynamic symbol table. This is what makes
  `dlopen()`'d addon `.so` files able to resolve `v8::`/`lo::` symbols
  against the running process at load time (standard `dlsym(RTLD_DEFAULT,
  ...)`-style resolution).
- **macOS**: addon `.so` bindings are built as *bundles*
  (`lib/build.js`'s `compile_bindings()`, [`lib/build.js:170-182`](../lib/build.js#L170-L182))
  linked with `-bundle_loader <path-to-lo>` — this tells `ld64` at the
  addon's *build* time to resolve the addon's undefined symbols directly
  against whatever `lo` itself exports. Mach-O main executables export all
  non-hidden global symbols by default, so `-rdynamic` in `LARGS` is likely
  inert here (Apple's `ld` doesn't have the same "export nothing unless
  asked" default that ELF does) — worth confirming with a real link, but
  it's consistent with `nm -D lo` (the ELF-oriented dynamic-symbol query)
  returning nothing on this Mach-O binary while `nm -gU` returns 35.9k.

Either way: **as long as any part of the toolchain needs `v8::`/internal
`lo::` symbols resolvable across a `dlopen`/bundle boundary, they have to be
in the final executable's export table** — hiding them at the source level
isn't possible (we don't own V8's compile step), so this has to be a
link-time allow/deny-list problem.

## One clarification on "fully static ⇒ no shared libraries"

Worth separating two things that look the same but aren't:

1. **Bindings that call back into `lo::`/`v8::`** — the
   `lib/<name>/<name>.so` files built by `compile_bindings()` and loaded via
   `core.dlopen('lib/${name}/${name}.so')` + `dlsym(..., '_register_${name}')`
   in `main.js`'s `load()` ([`main.js:162-193`](../main.js#L162-L193)). These
   genuinely need the host binary to export something for them to resolve
   against — this is the mechanism this proposal is about.
2. **Arbitrary C shared libraries called through the FFI**
   ([`lib/ffi.js`](../lib/ffi.js), the `dlopen`/`bind()` path exercised by
   [`test-ffi.js`](../test-ffi.js)/[`sum.c`](../sum.c)) — these only need
   symbols resolved in the *forward* direction (`lo` calling `dlsym()` on
   *them*), never the reverse. A fully static, zero-export `lo` binary can
   still `dlopen()` `sum.so` or `libcurl.so` and call into it just fine —
   `dlopen`/`dlsym` themselves don't require the host process to export
   anything.

So "no exports" doesn't mean "no `dlopen` at all" — it specifically means
"no `lo`-API-aware addon bindings that call back into the runtime." That's
a real, useful distinction to keep in the proposal and in any docs/error
messages, since the FFI path is unaffected and probably the more commonly
used one for embedding third-party C libraries.

It's also worth noting that bindings statically linked into `BINDINGS`
(`core.o`, `inflate.a`, `curl.o`, `system.o`, plus `epoll.o` on Linux /
`mach.o kevents.o` on macOS — [`Makefile:13-32`](../Makefile#L13-L32)) are
completely unaffected by any of this: they're link-time-resolved into the
same binary as `lo.cc`, never cross a dynamic-symbol boundary, and don't
need anything exported regardless of build mode.

## Proposed model: three export modes

Add a `EXPORTS` Makefile variable (default `full`, i.e. today's behavior,
for backwards compatibility while bindings are migrated):

| Mode | Exports | Use case |
|---|---|---|
| `full` | current behavior — `-rdynamic` (linux) / default Mach-O export (mac), all `DLL_PUBLIC` + all V8 symbols visible | today's status quo; needed until every dynamically-loaded binding stops calling `v8::`/wide `lo::` C++ symbols directly |
| `abi` | only the curated `extern "C"` ABI surface | once bindings are ported to the new C ABI: addons resolve only `lo_*` symbols, all V8/`lo::` C++ symbols hidden |
| `none` | nothing exported | fully static runtime that never loads `lo`-API-aware addon `.so` files; smallest possible binary |

`abi` and `none` both want `-fvisibility=hidden` applied as widely as
possible *and* a way to hide the V8-archive symbols specifically, since
those aren't ours to mark hidden at compile time.

### macOS

```make
ifeq ($(EXPORTS),none)
  LARGS += -Wl,-dead_strip -Wl,-dead_strip_dylibs
else ifeq ($(EXPORTS),abi)
  LARGS += -Wl,-exported_symbols_list,lo.exports -Wl,-dead_strip
else
  LARGS += -rdynamic   # current behavior
endif
```

- `-Wl,-exported_symbols_list,lo.exports` restricts the executable's export
  table to exactly the names/globs listed in `lo.exports`, **regardless of
  the visibility attributes the symbols were originally compiled with** —
  this is the mechanism that lets us hide V8's already-exported-by-default
  archive symbols without touching V8's build. For `abi` mode, `lo.exports`
  would list just the `lo_*` C ABI names (`_lo_create_isolate`,
  `_lo_shutdown`, etc. — Mach-O prefixes C symbols with `_`).
- For `none` mode, omit `-exported_symbols_list` entirely (or pass an empty
  list) — there's no addon host to expose anything to.
- `-Wl,-dead_strip` is safe to add in all modes; it's the standard `ld64`
  flag and doesn't depend on the export changes to be correct, though (see
  below) its payoff on V8's own code specifically is likely small.

### Linux (via `lld`, per `-fuse-ld=lld` already in `LARGS`)

```make
ifeq ($(EXPORTS),none)
  LARGS += -Wl,--gc-sections -Wl,--exclude-libs,ALL
else ifeq ($(EXPORTS),abi)
  LARGS += -Wl,--dynamic-list=lo.dynsym -Wl,--exclude-libs,ALL -Wl,--gc-sections
else
  LARGS += -rdynamic   # current behavior
endif
```

- `--dynamic-list=lo.dynsym` is the ELF/`lld` equivalent of
  `-exported_symbols_list`: only the symbols named in `lo.dynsym` go into
  `.dynsym`, instead of `-rdynamic`'s "export everything."
- `--exclude-libs,ALL` (a GNU ld/gold/lld feature) hides symbols that
  *originated from a static archive* from the dynamic symbol table
  specifically — a second, belt-and-suspenders way to make sure nothing
  from `libv8_monolith.a` (or any other bundled `.a`) leaks out even if it
  would otherwise have matched something.
- `--gc-sections` needs `-ffunction-sections -fdata-sections` added to
  `CCARGS`/`CARGS` for our own TUs to have any effect on `lo`'s own object
  files (see caveat below re: V8's own code).

### One list to maintain

`lo.exports` (mac) and `lo.dynsym` (linux, `--dynamic-list` file syntax) are
two different file formats for the same underlying idea — a maintained list
of the ABI's `extern "C"` names. Generating both from one source (e.g. a
small script deriving them from whatever's marked with a new
`LO_ABI`/`DLL_PUBLIC`-alongside marker in `lo.h`) avoids them drifting out
of sync as ABI functions are added. Exact generation mechanism is an
implementation detail for whoever builds this — noted here so it's not
forgotten, not specified further since it's outside build-mechanics scope.

## Dead-code stripping: what to actually expect

Checked whether `v8/libv8_monolith.a`'s object files were built with
`-ffunction-sections` (which is what makes `--gc-sections`/`-dead_strip`
able to drop *individual unused functions* out of an already-linked-in
object, rather than just whole never-referenced archive members):

```
$ ar x v8/libv8_monolith.a abort-mode.o && otool -l abort-mode.o | grep sectname
__text
__data
```

One `__text` section per translation unit — not function-level sections.
Since the linker already only pulls in archive members it needs to satisfy
existing relocations (that's how static archives work regardless of
`dead_strip`), and V8's TUs aren't split finely enough for the linker to
drop unused functions *within* an already-referenced TU, **`--gc-sections`
/ `-dead_strip` is expected to buy little to nothing on V8's own code**. Its
real value is on `lo`'s own object files if we add
`-ffunction-sections -fdata-sections` to `CCARGS`/`CARGS` — a much smaller
slice of the binary, so a modest win, still worth doing since it's close to
free.

The dominant, reliable win is the export-table cut described above (~16%
measured), plus the pre-existing lever this repo already has for trimming
V8/binding code itself: choosing a smaller `runtime/*.config.js` (`zero`
instead of `lo`, see [`runtime/README.md`](../runtime/README.md)) links
fewer bindings and builtins in the first place. `EXPORTS=none` and a minimal
runtime config are complementary, not alternatives.

## Migration path

1. Land `EXPORTS` as a Makefile variable, default `full` — no behavior
   change for anyone building today.
2. As bindings currently built as separate `.so` files via
   `compile_bindings()` (e.g. `luajit`, `python`, `sqlite`-style optional
   bindings) are ported to call only the `extern "C"` ABI instead of
   `v8::`/wide `lo::` symbols directly, add their required entry points to
   `lo.h`'s `extern "C"` block and to `lo.exports`/`lo.dynsym`.
3. Once no shipped binding needs anything outside that list, flip the
   default to `EXPORTS=abi`.
4. `EXPORTS=none` becomes documented as the mode for people building a
   fully static `lo` that never dynamically loads `lo`-API-aware bindings
   (it can still use the FFI/`dlopen` path for arbitrary C libraries, per
   the clarification above).

## Validation plan (not run as part of this proposal)

Once implemented, compare against the baseline numbers captured here:

```
ls -la lo                                    # total size
otool -l lo | grep -A3 LC_SYMTAB             # nsyms / strsize
otool -l lo | grep -A2 LC_DYLD_EXPORTS_TRIE  # export trie size
nm -gU lo | wc -l                            # exported symbol count
nm -gU lo | grep -c _ZN2v8                   # V8 symbols still exported (should be ~0 in abi/none)
```

On Linux, the equivalent is `size lo`, `readelf -d lo` / `nm -D lo | wc -l`,
and `readelf -S lo` for `.dynsym`/`.dynstr` sizes. This should be run on an
actual Linux build to confirm `--exclude-libs`/`--dynamic-list` behave as
expected under `lld` specifically (both are documented `lld` features, but
haven't been verified against this build here since this environment is
macOS).

## Open questions / risks

- **Mode mismatch**: an addon `.so` built with `-bundle_loader`/linked
  against an `abi`-mode host will fail to resolve any symbol outside the
  ABI list. `compile_bindings()` and the host binary need to agree on
  `EXPORTS` mode; worth having the build tooling record/check this rather
  than discovering it as a link or load-time failure.
- **Windows** has no equivalent story in this pass — the Windows build
  (`main_win.h`, `.exe` target) doesn't currently show a dynamically-loaded
  addon mechanism analogous to `-bundle_loader`/`-rdynamic`; `__declspec`
  export control would need separate treatment if/when Windows addon
  loading is added.
- **`--exclude-libs,ALL` scope**: it hides symbols from *every* static
  archive linked in, not just `libv8_monolith.a` — should be harmless given
  none of the other bundled `.a`s (`inflate.a`, per-binding `.a`s) are
  meant to export anything either, but worth confirming nothing currently
  relies on one of those leaking a symbol.
