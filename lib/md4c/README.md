# md4c

Binding for [md4c](https://github.com/mity/md4c) (vendored in `deps/md4c`) —
a fast, dependency-free C markdown parser/renderer (CommonMark +
GitHub-flavored extensions: tables, strikethrough, task lists, etc.).
Built as a real static lib (`deps/md4c/build/src/libmd4c{,-html}.a`, see
`build.js`) and linked into `md4c.cc` the normal generated-binding way —
getting it working just needed `stdlib.h`/`string.h` added to `includes`
(`api.js`) for symbols md4c's own headers assume are already visible.

## What's exposed (`api.js`)

- **`parse(markdown, len, MD_PARSER*, userdata)`** → `md_parse`. The raw,
  SAX-style parser: caller provides a `MD_PARSER` struct of five
  callbacks (`enter_block`/`leave_block`/`enter_span`/`leave_span`/
  `text`) and gets called back once per markdown construct. No HTML
  involved — this is the mechanism `md-to-html` conversion itself is
  built on top of, and also how a caller would build something other
  than HTML (a table of contents, a plain-text extractor, ...).
- **`html(markdown, len, process_output, userdata, parserFlags,
  rendererFlags)`** → `md_html`. md4c's own built-in HTML renderer —
  drives `parse()` internally and calls `process_output(text, size,
  userdata)` with HTML fragments as they're produced.
- **`to_html(markdown, len, HtmlBuffer*)`** — *not* `md_html` directly;
  a small C convenience wrapper in this binding's own `preamble`
  (`api.js`'s `preamble` string) that drives `md_html` with a growable,
  `realloc`-backed `HtmlBuffer` struct instead of a JS callback, so the
  whole document's HTML comes back in one native buffer rather than one
  JS call per fragment. **Naming collision to know about**: the
  top-level [`md.js`](../../md.js) demo script also defines its own,
  unrelated `to_html(markdown)` JS function that calls `html()` +
  a JS-side `process_output` callback — same name, different
  implementation, not calling into this native one. If both patterns
  end up used side by side, rename one.
- **`constants`**: the full `MD_BLOCKTYPE`/`MD_SPANTYPE`/`MD_TEXTTYPE`/
  `MD_ALIGN`/`MD_FLAG_*`/`MD_HTML_FLAG_*` enums, all plain `i32`.
- **`structs`**: `sizeof()` constants for `MD_PARSER` and every
  `MD_*_DETAIL` struct `enter_block`/`enter_span` can hand back via
  their `detail` pointer (needed to know how many bytes to allocate
  before reading one).

## Using the SAX-style parser from JS: `md.js`

[`md.js`](../../md.js) (repo root) is the real, working demo of the
harder path — running md4c's five-callback `parse()` from pure JS,
using [`lib/ffi.js`](../ffi.js)'s `generate_callback`/`Struct` (the same
JIT-a-trampoline machinery `lib/core`'s own FFI preamble uses for
arbitrary `dlopen`'d calls, applied here to a *caller-provided struct of
callbacks* instead of a single bound function). Confirmed working
end-to-end: parses a real markdown file, produces correct HTML via the
JS-callback path, ~26MB/s throughput in `Bench`-measured round trips.

Two things worth knowing if this becomes a template for binding other
callback-heavy C libraries the same way:

- **`Struct`'s unfilled tail is safe by construction, not luck.**
  `MD_PARSER` has two more optional fields after the five callbacks
  (`debug_log`, `syntax` — both NULL-checked by md4c before use, per its
  own header). `md.js`'s `createParser` only ever writes the five
  required fields into a 64-byte `Struct`, leaving 16 bytes unwritten.
  That's fine specifically because `Struct` backs itself with a real
  `ArrayBuffer`, and JS guarantees a fresh `ArrayBuffer` is
  zero-initialized — so the unwritten tail really is NULL, matching
  what md4c expects for "not provided."
- **Every callback `md.js` declares is missing its real last
  parameter.** `md4c.h`'s actual signatures all end in a `void*
  userdata` — `enter_block`/`leave_block`/`enter_span`/`leave_span` are
  `(type, detail, userdata)`, `text` is `(type, text, size, userdata)` —
  but `md.js`'s `generate_callback` calls only declare `['u32',
  'pointer']` / `['u32', 'pointer', 'u32']`, one parameter short each.
  Harmless *today* because `userdata` is always passed as `0` and never
  read: on both x64 SysV and ARM64 AAPCS64, pointer/integer args live in
  registers regardless of how many the generated trampoline bothers to
  read, so an unread trailing register causes no misalignment. It stops
  being harmless the moment `userdata` is actually needed (e.g., a
  per-call context object instead of relying on module-level closures
  like `results`) — at that point all five `generate_callback` calls
  need the extra `'pointer'` parameter added, not just the one that
  happens to use it.

## Future work

- **Fix the `userdata` gap in `md.js` before relying on it** — cheap
  (one more `'pointer'` entry per `generate_callback` call), and turns a
  "works by calling-convention coincidence" pattern into a genuinely
  correct one. Worth doing before this becomes a copy-paste template for
  the next callback-heavy binding.
- **Benchmark the native `to_html`/`HtmlBuffer` path against `md.js`'s
  JS-callback path.** `md.js` currently measures only the JS-callback
  route (~26MB/s); the native route never crosses back into JS per HTML
  fragment (only once per document), so it should be faster for large
  documents — not measured yet.
- **Rename one of the two `to_html`s** if both end up used from the same
  codebase, to kill the naming collision above before it causes real
  confusion.
- **A reusable `createParser`-style helper**, generalized out of
  `md.js`'s own version, if another SAX-style/callback-struct C library
  ends up bound the same way — right now the pattern (build a `Struct`,
  fill it with `generate_callback(...).fn` pointers in field order) is
  specific to `md.js`, not shared library code.
