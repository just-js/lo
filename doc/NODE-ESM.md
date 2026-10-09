# Plan: Node.js-style ESM module resolution as a runtime option

Status: **planning, open questions** (2026-10-09). Nothing has been built.

## Goal

A runtime can opt into Node.js's ESM resolution, so it can import pure-JS
npm packages from a `node_modules` tree. The runtime config chooses the mode:

```js
// runtime/<name>.config.js
const resolution = 'node-esm'   // 'lo' (default, today's behavior) | 'node-esm' | later others
```

- **ESM only.** No CommonJS, no `require`, and no interop between CommonJS
  and ESM. A package that only ships CommonJS (`lodash`, `yaml`,
  `typescript` up to 6) isn't supported.
- **A first pass.** It's fine if it isn't perfect: support the simple
  packages first, then fill in rules as packages need them.
- **`node:` built-ins** (`node:fs`, ...) fail with a clear error. lo can
  add compatibility for them gradually later.
- `'lo'` stays the default, and existing runtimes don't change.

## What exists today

There are two hook layers in `main.js` / `lo.cc`:

1. **`lo.setModuleCallbacks(on_module_load, on_module_instantiate)`**
   replaces the whole pipeline (example: `ev.js`).
   - `on_module_load(specifier, resource)` handles `import()`. `resource`
     names the importing script, and whatever it returns becomes the
     `import()` result.
   - `on_module_instantiate(specifier)` handles static imports. It's called
     synchronously from `lo::OnModuleInstantiate` and must return a module
     identity from `lo.loadModule(src, specifier)`.
2. **`core.loader(specifier, resource)` / `core.sync_loader(specifier,
   resource)`** run inside the default callbacks' `load_source` /
   `load_source_sync`. They only supply source text: the module's name and
   cache key stay the raw specifier.

Default resolution (`load_source`): the embedded builtin by specifier
string, then the path as given (relative to the current directory), then
`$LO_HOME/<specifier>`. `LO_CACHE=1` skips the builtin.

### What resolution can't do yet (prerequisites, for every mode)

1. **Static imports don't know their importer.** `lo::OnModuleInstantiate`
   gets the `referrer` module but passes only the specifier to JS. There's a
   `todo: we need to specify the calling module path here` in
   `on_module_instantiate`. Node's resolution is relative to the importing
   file: `./x.js`, and the `node_modules` lookup through each parent
   directory. Fix: pass the referrer's name or identity, e.g. through a
   map of module identity to resolved path that `main.js` keeps.
2. **The cache key is the raw specifier.** Two files that import their own
   `./util.js` get one module, and one file reached through two specifiers
   runs twice. It should be the resolved absolute path (or URL). This is
   probably also the root cause of the relative-import crash (PLAN task 79,
   `LO.md` hands-on §4).
3. **`import.meta` is empty.** `import.meta.url` is `''` today, and
   packages use `new URL('./x', import.meta.url)`. Fix: V8's
   `SetHostInitializeImportMetaObjectCallback`, filled from the resolved
   path. `import.meta.resolve` can come later.
4. **One load per module under custom callbacks.** The default
   `on_module_load` now shares one in-flight load per specifier (PLAN task
   103). Custom callbacks installed with `setModuleCallbacks` need the same,
   keyed by resolved path.

Items 1-3 also benefit plain `'lo'` mode, which would keep its current rules
through the same hooks.

### How the mode would be wired in

- `resolution` in the runtime config. `lib/build.js` embeds only the
  selected resolver (e.g. `lib/resolve/node-esm.js`). At startup `main.js`
  installs its callbacks in place of the defaults. Runtimes that don't use
  it don't carry its code.
- Open: choose at build time only, or also allow a startup override (an
  env var or flag, like `LO_CACHE`)?
- The `--parse` scanner in `doc/PLAN-BUNDLE.md` has to resolve the same
  way, so it should use the same resolver module rather than a copy.
  Embedding packages under `node_modules/...` names in a runtime is a
  separate question, in the "Module naming" section there.

## First-pass scope for `node-esm`

Node's resolution algorithm is ESM_RESOLVE / PACKAGE_RESOLVE in Node's
`doc/api/esm.md`. A Node source snapshot is at `repos/node`. The subset, in
order of need:

| Specifier | First pass | Later |
|---|---|---|
| `./x.js`, `../x.js`, `/abs/x.js` | yes, relative to the importer; full file extension required (Node's ESM rules: no extension or `index.js` guessing) | `file:` URLs |
| bare `pkg`, `pkg/sub/path.js` | yes: look for `node_modules/pkg` in the importer's directory and each parent directory | `NODE_PATH`-like extra roots |
| `package.json` `exports`: a string, a subpath map, conditions | yes | |
| `exports` subpath patterns (`"./*": "./dist/*.js"`) | yes (date-fns and zod use them) | |
| no `exports`: `main`, then `index.js` | yes (lodash-es relies on it) | |
| `imports` (`#internal`) | no | when a package needs it |
| a package importing itself by name | no | when a package needs it |
| `node:` built-ins | clear error | gradual compatibility shims |
| JSON modules (`with { type: 'json' }`) | no | maybe |
| `.cjs`, or `"type": "commonjs"` without an ESM entry | clear error | not planned |

Symlinks: resolve to the real path, which is the cache key. Plain npm or
yarn-classic layouts and bun's default hoisted `node_modules` all work like
this. pnpm's layout, with packages symlinked into a `.pnpm/` store, also
mostly works once symlinks resolve to real paths, but isn't a first-pass
target.

## Candidate packages (registry data, checked 2026-10-09)

Pure ESM entry, no dependencies, no `node:` imports in the files reached
through `import`/`default`. Checked with `npm view` plus a scan of the
published files (`npm pack`).

| Package | Version | Exercises | Notes |
|---|---|---|---|
| `acorn` | 8.19.0 | `exports` with `import`/`default` → `dist/acorn.mjs` | lo has a copy in `lib/acorn/` |
| `acorn-walk` | 8.3.5 | `exports` `import`; depends on `acorn` | |
| `lodash-es` | 4.18.1 | no `exports`, `"type":"module"`, `main`; 644 files of `./x.js` imports; subpaths like `lodash-es/map.js` | relative resolution at scale. Feature-detects `Buffer` (guarded) |
| `marked` | 18.1.0 | `exports` `default` | |
| `valibot` | 1.5.0 | `exports` `import`/`default` | |
| `zod` | 4.6.5 | 12 subpath exports, `import` | |
| `date-fns` | 4.4.0 | 741 export keys (patterns and subpaths), 1428 files | `cdn.js` and two other files mention `require`, but aren't on the ESM path |
| `smol-toml` | 1.9.1 | `exports` `import` | |
| `astring` | 1.9.0 | `exports` `import` / `browser` | |
| `meriyah` | 7.4.0 | `exports` `import` / `module-sync` | another JS parser |
| `preact` | 11.0.1 | 22 subpath exports; `preact/hooks` imports `"preact"` | a package's subpath importing its own package name, through the `node_modules` lookup |

These depend on the choice of conditions (next section):

| Package | Issue |
|---|---|
| `nanoid` 6.0.2 | `default` → `index.js` uses Node's `Buffer.allocUnsafe`. `browser` → `index.browser.js` uses only `crypto.getRandomValues` (a web API: does lo have it?) |
| `fflate` 0.8.3 | `node` → `esm/index.mjs` uses `require('worker_threads')`. `import` → `esm/browser.js` is clean. Shows that the `node` condition can hurt |
| `immer` 11.1.21 | its ESM build reads `process.env.NODE_ENV`: needs a `process.env` shim or the `production` condition, if the package offers one |

Not candidates: `lodash` (CommonJS only; use `lodash-es`), `typescript` 7
(native Go binaries in per-platform packages; earlier versions are
CommonJS), `yaml` (`"type":"commonjs"`).

## Package `exports` conditions

`package.json` `exports` can map an entry to different files depending on
**conditions**:

```json
"exports": {
  ".": {
    "types":   "./index.d.ts",
    "browser": "./index.browser.js",
    "node":    "./index.node.js",
    "import":  "./index.mjs",
    "default": "./index.js"
  }
}
```

The resolver has an ordered set of **active conditions**. It walks each
object **in the package's key order**, not its own, and takes the first key
that is active. Nested objects are walked the same way, as in `fflate`'s
`node: { import: ... }`. So the package author decides precedence, and the
runtime only decides which keys count.

What Node, other runtimes and bundlers use:
- **Node (ESM):** `node`, `import`, `default`. Optionally `development` or
  `production`, and `module-sync` in newer Node versions.
- **Deno:** `deno`, `node`, `import`, `default`.
- **Bun:** `bun`, `node`, `import`, `default`.
- **workerd (Cloudflare):** `workerd`, `worker`, `browser`, `import`,
  `default`.
- **Bundlers for browsers:** `browser`, `import`, `module`, `default`.
- `types` is for TypeScript only. A runtime never counts it.

Options for lo:

1. **Node's set: `node`, `import`, `default`.** Maximum compatibility with
   what package authors test against, but `node` entries tend to use Node
   APIs (`fflate` → `worker_threads`, `nanoid` → `Buffer`). Only worth it
   once lo has `node:` shims.
2. **Browser-like: `browser`, `import`, `default`.** Picks builds that use
   web APIs instead of Node's (`nanoid`'s `crypto.getRandomValues`,
   `fflate`'s `Worker` + `postMessage`). This works only as far as lo has
   those web APIs. `browser` builds sometimes also assume the DOM.
3. **A lo key first: `lo`, then option 1 or 2.** Like `deno`/`bun`/`workerd`:
   packages, or lo's own packages, can ship a lo-specific entry, and
   everything else falls back. It costs nothing to include.
4. **Configurable in the runtime config,** e.g.
   `conditions: ['lo', 'import', 'default']`, with a default chosen per
   mode.

A suggested first pass, to discuss: option 4 with a default of `lo`,
`import`, `default`. It's the most neutral: it covers all the clean
packages above and picks neither Node's nor the browser's variant. A runtime
can add `browser` or `node` explicitly, e.g. to get `nanoid`'s browser
build.

## Open questions

1. **lo's builtins vs npm names (undecided).** Under Node's rules,
   `lib/fs.js` means "subpath `fs.js` of the package named `lib`". Options:
   - **`node-esm` first, then lo's resolution (current leaning):** a bare
     specifier that doesn't resolve in `node_modules` falls back to lo's
     rules. Simple and backwards compatible. Risks: an npm package named
     `lib` shadows lo's `lib/*.js`, and every lo builtin import first walks
     the parent directories looking for `node_modules/lib`. That cost can be
     cached, or the walk skipped for names that exist as embedded
     builtins.
   - lo's builtins first, then `node-esm`: never shadowed. But an npm
     package that happens to share a name with a builtin path can't be
     reached.
   - A prefix (`lo:fs` → `lib/fs.js`), like Node's `node:`: unambiguous,
     but every existing import in `lib/` and in runtimes would change.
2. **Ecosystems and install layouts.** npm, yarn (classic and
   Plug'n'Play), pnpm, bun, Deno's `npm:` specifiers, and import maps.
   Suggested approach: one set of rules per ecosystem, each a small module
   on top of a shared core (package.json parsing, `exports` matching, a
   cache of resolved paths). The first pass is just the common case
   (`node_modules` directories, symlinks resolved to real paths). Import maps
   (a browser standard, also in Deno) might be the cleanest extra
   "ecosystem" for lo itself.
3. **Build time vs run time.** Is `resolution` fixed in the runtime, or
   can it also be switched when lo starts?
4. **Embedding.** Should a runtime be able to embed resolved
   `node_modules` files like `lib/*.js` (names, `--parse` integration;
   `doc/PLAN-BUNDLE.md`)?
5. **Globals that "pure" packages still assume:** `process.env` (immer),
   `crypto.getRandomValues` (nanoid browser), `URL`, `atob`/`btoa`,
   `structuredClone`, `queueMicrotask`. This overlaps with WinterTC (below)
   more than with resolution.

## WinterCG / WinterTC

WinterCG, the W3C community group for server-side JS runtimes, became Ecma
**TC55 ("WinterTC")** in January 2025. Its first standard, **ECMA-429
"Minimum common web API" Edition 1**, was published in December 2025. So
the effort is alive, just under Ecma now. It specifies globals (`fetch`,
`URL`, `TextEncoder`, `crypto`, `AbortController`, streams, ...), not
module resolution, so it's a separate track from this plan. It connects in
two places:
- Implementing parts of ECMA-429 is what would make the `browser`
  condition (option 2 above) useful, and what many "pure" packages assume
  anyway (open question 5).
- WinterCG also kept a registry of runtime keys for `exports` conditions
  (`deno`, `bun`, `workerd`, ...). Registering `lo` there would go with
  option 3. (Not checked: whether the registry moved to TC55 too.)

Sources: [WinterCG becomes Ecma's WinterTC (Igalia)](https://www.igalia.com/2025/01/10/WinterCG-becomes-Ecmas-WinterTC.html),
[W3C/Ecma blog on WinterTC](https://www.w3.org/blog/2025/collaborating-across-w3c-and-ecma-for-web-interoperable-server-runtimes-through-wintertc/),
[Ecma news](https://ecma-international.org/news/collaborating-across-w3c-and-ecma-for-web-interoperable-server-runtimes-through-wintertc).

## Testing (when built)

- Fixtures in `test/`: a small hand-made `node_modules` tree with
  `exports` variants (string, subpath map, conditions, patterns, `main`
  only, nested packages, a symlink). Test resolution separately from
  loading.
- Compare against Node, which is installed in the sandbox's Alpine
  toolchain: `import.meta.resolve(specifier)` from the same importer on the
  same tree, with the same conditions (`node --conditions=...`). Report any
  difference.
- The candidate packages above as integration tests (installed once with
  `npm install` into a fixture directory, not checked in).
- `test/import.js` (PLAN task 103) keeps covering loading itself.
