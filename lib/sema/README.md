# sema

Bun's TypeScript type checker (`bun check`, oven-sh/bun `src/sema`) as a lo
binding, through the C ABI library of
[just-js/ts-sema](https://github.com/just-js/ts-sema). The `sema-tsc` runtime
(`runtime/sema-tsc.config.js`) uses it.

```js
const { sema } = lo.load('sema')
const project = cstr('tsconfig.json')   // a tsconfig.json or its directory
const len = ptr(new Uint8Array(8))      // size_t out parameter
// lib dir 0 (null): the built-in TypeScript lib.*.d.ts files; threads 0: one per core
const report = sema.check(project.ptr, 0, 0, len.ptr)
const json = JSON.parse(utf8_decode(report, Number(new BigUint64Array(len.buffer)[0])))
sema.free(report)                       // bun_sema_free, never libc free()
```

`runtime/sema-tsc.js` is a full example: a tsc-compatible command line.

Lib files: `sema.set_libs(names, texts, lens, count)` (arrays of addresses, before
the first check) replaces the built-in TypeScript lib files for the rest of the
process, borrowing the texts. Files embedded in a custom runtime are ideal:
`lo.builtin('lib.es2022.d.ts', false)` returns the embedded bytes without a copy.
`sema.builtin_lib(name, len)` returns a built-in file's text (free it with
`sema.free`).

## Building

`build.js` makes `ts_sema.o` (the library linked into one relocatable object,
with only the C ABI's four `bun_sema_*` functions left global) and `ts_sema.h`. The
archive comes from:

- `TS_SEMA_A=<path>/libts_sema.a`: a local ts-sema build (its `dist/`, which
  also holds `ts_sema.h`).
- By default, the prebuilt release asset `ts-sema-<target>.tar.gz` of release
  `TS_SEMA_REF` (or the one pinned in `build.js`) for this platform's Rust target
  (`x86_64`/`aarch64` × `unknown-linux-gnu`/`unknown-linux-musl` (with `MUSL=1`)
  or `apple-darwin`; `TS_SEMA_TARGET` overrides), unpacked into
  `deps/ts-sema-<ref>/`.
- `TS_SEMA_SOURCE=1`: ts-sema's source tarball at `TS_SEMA_REF` (a tag or a
  commit), built in `deps/` with ts-sema's own `build.js`. `TS_SEMA_BUILD_ARGS`
  is passed to it, e.g. `"--jobs 1 --nice 19"`.

Downloads use lo's own curl, inflate and untar.

Delete `ts_sema.o` to pick up a new archive.

## Requirements

Building from source (ts-sema's README has the details):

- Node 22 or newer, to run ts-sema's `build.js`
- a nightly Rust toolchain with cargo, and network access for crates.io
- a C compiler and `ar` (mimalloc)
- about 3 GB of free memory for rustc, about 10 minutes on one core

Always:

- `ld` and `objcopy` (GNU binutils or LLVM's), for `ts_sema.o`. Linux only for
  now: macOS has no `objcopy` (to do)
- libzstd to link (`libs: ['zstd']`): the built-in lib files are zstd frames
- dead-code elimination in the final link (`--gc-sections`, which lo's runtimes
  use): the archive refers to parts of Bun's C/C++ side that the checker never
  reaches
