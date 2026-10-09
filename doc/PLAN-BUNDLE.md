# Plan: generating runtime configs by parsing the program

Status: **planning** (2026-09-27). A working prototype scanner exists
(`lib/parse.js`, `lib/acorn/`, `parse-test.js`, all uncommitted); nothing is
wired into `lo build` yet.

## Goal

Let a user do:

```sh
mkdir foo
cd foo
lo init                        # foo.js, foo.config.js (+ later: types, IDE files)
# edit foo.js: add imports, subdirectories, bindings ...
lo build runtime foo --parse   # discover libs + bindings from the code, build
```

`--parse` is **explicit opt-in**. The default stays manual mode, exactly as
today: the config's `bindings`/`libs`/`embeds` arrays are the whole list.

## What exists now

- `lib/acorn/`: acorn 8.18.0 (`acorn.js`) and acorn-walk 8.3.5 (`walk.js`),
  vendored from node's `deps/acorn` (`dist/*.mjs`, renamed). MIT, LICENSE
  included. Single-file ESM, no relative imports.
- `lib/parse.js`: `await parse(path, { root })` → `{ bindings, libs, warnings }`.
  - Follows `import`, `export ... from` and `import()` with a literal (or
    expression-free template) specifier, when it resolves to a file.
  - Collects bindings from `lo.load('x')`, `lo.library('x')`, bare
    `load('x')` / `library('x')`.
  - **Platform guards**: `os`, `core.os`, `lo.core.os` compared with
    `===`/`!==` against `'linux'|'mac'|'win'`, through `!`, `&&`, `||`,
    `if`/`else`, `?:` and `a && x` / `a || x`. Guarded bindings come back in
    `build_runtime`'s tagged form, e.g. `{ epoll: ['linux'] }`.
  - **Runtime guards**: code that can't run on lo is skipped:
    `globalThis.lo` is true, `globalThis.Deno` / `globalThis.Bun` (and chains
    off them) are false. `globalThis.process` is deliberately unknown
    (`lib/bench.js` assigns it on lo). Hardcoded for now (see `defines` below).
  - Any other condition (e.g. `getenv(...)`) is unknown: both branches are
    included.
  - Warnings: non-literal import specifiers / binding names, unresolved
    imports.
  - Resolves bare specifiers against `root` only (default cwd), which isn't
    enough yet (see resolution below).
- `parse-test.js <file.js | name.config.js>`: for a config, it picks the
  entries by the rules below (without `workerSource` folding yet), scans them,
  and diffs the result against the config's arrays.

Run it (from the repo root; `LO_CACHE=1` makes lo read `lib/*.js` from disk
instead of the copies embedded in the `lo` binary, and the script path must be
absolute):

```sh
LO_CACHE=1 ./lo $PWD/parse-test.js runtime/proxy.js          # one file
LO_CACHE=1 ./lo $PWD/parse-test.js runtime/proxy.config.js   # config + diff
```

Result on `runtime/proxy.js`: libs identical to the hand-written
`runtime/proxy.config.js`; bindings `net`, `libssl`, `boringssl`,
`epoll`/`system` (linux), `kevents`/`mach` (mac), `win` (win). `core` only
appears once `main.js` is scanned.

## Where the relevant code is

- `main.js`: `load_source` / `load_source_sync` (module resolution: embedded
  builtin, then path as given, then `LO_HOME`; `LO_CACHE=1` skips the
  builtin), `library('core')` at bootstrap, `handleCommand` (CLI commands and
  their dynamic imports), `global_main`, and the final
  `if (workerSource) ... else global_main()` dispatch.
- `lib/build.js`:
  - `build` (`lo build runtime <name>`, imports `<name>.config.js`)
  - `build_runtime` (consumes the config; `platform_bindings` handles the
    `{ name: [platforms] }` form)
  - `create_builtins` / `verify_path` (embeds libs, resolved against cwd then
    `LO_HOME`)
  - `init` and `generate_config` (what `lo init` writes)
  - `bootstrap_app_dir` (IDE files, not called yet)
- Configs: `runtime/core.config.js` (the plain lo shape `lo init` starts from),
  `runtime/zero.config.js` (`main` overridden, no bindings),
  `runtime/proxy.config.js` + `runtime/proxy.js` (the test case, `index` shape).
- Bindings: `lib/<name>/api.js` defines each one; a lib loads it with
  `lo.load('<name>')`.

## The three runtime shapes

What gets scanned follows from the config. There's no separate mode switch.

| Config | What runs | Scan |
|---|---|---|
| `main` overridden (e.g. `runtime/zero.config.js`) | only that script | `main`'s graph, nothing else. No implicit `core`. |
| `index`, default `main.js` (proxy, every `lo init` project) | `main.js` bootstrap, then `if (workerSource) import('worker_source.js')` | `main.js` with `workerSource` folded to true, plus `index`'s graph |
| neither (lo itself, `runtime/core.config.js`) | full CLI: `global_main()` → `handleCommand` | all of `main.js` |

`workerSource` is set by `lo.cc` exactly when an index is embedded, so the
build knows its value statically. Folding it makes `handleCommand`'s
dynamic `lib/build.js` / `lib/gen.js` / `lib/repl.js` imports (and their
`curl`, `inflate`, `bestlines`, ... bindings) unreachable for index runtimes.

### Planned `main.js` change (the user's)

Drop the loop / `setTimeout` / `setInterval` section of `global_main()` and
use what the Windows path already does on every OS:

```js
handleCommand(args).catch(err => { handle_error(err); exit(1) })
```

Nothing in core lo needs that section. It removes `lib/loop.js`,
`lib/timer.js`, `epoll`/`kevents`, `system` from the no-index CLI case. The
`workerSource` fold is still needed for index runtimes (`handleCommand`'s
dynamic imports remain reachable otherwise).

## Planned work

1. **Resolution like the loader.** The runtime loader tries the embedded
   builtin, then the path as given (cwd-relative), then `LO_HOME`; the build's
   `verify_path` tries cwd then `LO_HOME`. `parse` should do the same: project
   dir, then `LO_HOME`, then `lo.builtin()` for source text. That is how
   `main.js` and `lib/*.js` get scanned from inside a project that has neither
   on disk.
2. **Module naming.** A module is looked up in the embedded builtins by its
   specifier string, so a lib's entry in the config must match the string the
   importer uses. Supported:
   - bare project-relative specifiers (`'util/x.js'`, like `'lib/net.js'`)
   - absolute paths (the absolute path becomes the embedded name; fine, but
     the config isn't portable across machines)

   Relative specifiers (`./x.js`, `../x.js`): **warn**. They don't map
   one-to-one to an embedded name, and they hit the known relative-import
   segfault in lo's module loader.
3. **`defines` option** replacing the hardcoded runtime table, like esbuild's
   `--define`: `parse(path, { defines: { workerSource: true, 'globalThis.lo': true, 'globalThis.Deno': false, ... } })`.
   The build passes `workerSource` from the config shape.
4. **Build integration** behind `lo build runtime <name> --parse`: choose the
   entries (table above), scan, merge with the config (below), check that each
   binding has `lib/<name>/api.js` in the project or `LO_HOME`, build.
5. **`lo init`** writes the simple config (all the build flags, editable) and
   `<name>.js`. IDE support (tsconfig pointing at `$LO_HOME/lib`,
   `globals.d.ts`, package.json) is a separate follow-up; `bootstrap_app_dir`
   in `lib/build.js` already exists, but the call to it in `init` is commented
   out.

## Open: merging scan results with hand-edited arrays

Requirement: the user can edit `bindings` / `libs` / `embeds` by hand, and
`--parse` merges what it finds with what the user supplied. The hard part is
telling, on the next build, a user entry from a previously generated one, so
that deleting an import from the code removes its lib without ever removing a
hand-added one.

Options considered:

- **Union, write back, never remove.** Simple; stale entries accumulate.
- **Tag generated entries with a trailing comment** (`'lib/net.js', // parsed`)
  and replace only tagged ones. **Rejected**: too fragile.
- **Don't write back to the config at all.** The config arrays hold only
  what the user writes (in manual mode, the full list, as today). With
  `--parse`, the build unions scan ∪ config arrays in memory and builds from
  that. Stale entries can't exist because the scan is never saved, and
  hand-added ones are never touched. For visibility the build can print the
  merged list and/or write a generated, not-for-editing file (e.g.
  `foo.deps.json`). Trade-off: under `--parse` the config doesn't show the
  complete list.

Still needs more thought; not decided.

## Open: other items

- **Embeds** (`embeds` in a config end up in `lo.builtins()`): currently
  assumed to be text. Users may embed arbitrary binary files, which need
  binary-safe storage and a way to look them up at runtime. The user has
  existing code for this. The scanner does not try to detect embeds; they stay
  hand-listed.
- **`LOSSL` in `lib/libssl.js`** (env-selected `libssl` vs `boringssl`): the
  scan currently includes both, and `boringssl` is a heavy build. The plan is
  to take that switch out of `lib/libssl.js` and find another way to load
  alternative bindings with the same or similar API.
- **Non-analysable loads** (`lo.load(name)`, `import(filePath)`): reported as
  warnings; the user adds what's needed by hand.

## Prior art (for reference)

- Bundlers / single-binary compilers (esbuild, Rollup, webpack,
  `deno compile`, `bun build --compile`): static import graph from literal
  specifiers; non-literal dynamic imports warned about or need explicit
  includes (Deno `--include`); environment branches handled with compile-time
  constants plus dead-code elimination (esbuild `--define`).
- vercel/nft and vercel/pkg: trace files including native addons by static
  analysis with partial evaluation; aim to over-include; explicit
  include/ignore config for the rest.
- Node, Deno and Bun link every builtin into the binary, so they never need
  to detect native bindings. QuickJS `qjsc` follows JS imports statically, but
  native C modules are added by hand (`-M`).
