# CPU-profiling `lo` with `perf` — no hardware PMU required

How to get a real flame graph for a hot native path in this sandbox,
written up after actually doing it for `lo_abi_v8.cc`'s `GenericDispatch`
(WORK.E.1 — see [WORK.E.1.md](WORK.E.1.md)). The tooling is generic to
any `lo` script, not specific to that investigation.

## Why this isn't the usual `perf record -e cycles -g`

This sandbox's guest kernel exposes no hardware PMU (see the outer
repo's `KVM-MITIGATIONS.md`) — `perf`'s default hardware `cycles`/
`instructions` events don't work here. That doesn't rule `perf` out
entirely: **software events** (`cpu-clock`, `task-clock`, ...) are
scheduler/timer-driven, not PMU-driven, and work fine — confirmed
directly (`perf stat -e task-clock -- sleep 1` reports real numbers).
`perf record -e cpu-clock -g` is the one to reach for here.

## One-time setup

1. **Install `perf` with its real dependency closure, not just the bare
   package** (from the outer repo root, `/root/cloned/claude`):
   ```sh
   ./tools/alpine-pkg.sh closure perf   # see what it actually needs
   ./tools/alpine-pkg.sh install perf libtraceevent-plugins numactl slang libtraceevent --repos main,community
   ```
   `install perf` alone gets you a binary that immediately fails with a
   wall of `Error relocating ... symbol not found` — it links against
   `libslang`/`libnuma`/`libtraceevent`, which `install` (as opposed to
   `closure`) does not pull in. This is the exact gotcha
   `tools/README.md` already warns about for `alpine-pkg.sh install` in
   general; `perf` is just the instance that bit this session.

2. `perf` ends up at
   `/root/demo/alpine-toolchain/root/usr/bin/perf` — already covered by
   the standing `LD_LIBRARY_PATH`/`PATH` setup in `~/.profile` once
   installed.

## Two build-side requirements for symbols to resolve at all

1. **Don't strip.** The normal build links with `-s` (see
   `lib/build.js`'s `link_args`/`LARGS` default) — a stripped `.so`
   shows raw hex addresses in `perf report`/`perf annotate`, not
   function names. Override per-build:
   ```sh
   LARGS='-fno-exceptions -O3' LO_CACHE=1 NOGEN=1 ./build-module.sh <binding>
   ```
   (drop `NOGEN=1` for a binding whose `.cc` is meant to be
   regenerated). For the main `lo` binary/V8 itself, add `-g` to the
   runtime's own `opt` config instead — see `LO-DEBUGGING.md`'s "Build
   with debug symbols" section, same requirement, already documented
   there for crash debugging.

2. **Use DWARF call-graph unwinding, not frame-pointer.** The standard
   `CFLAGS` bake in `-fomit-frame-pointer`, which breaks `perf record
   -g`'s default frame-pointer-based unwinding (stacks come back
   truncated/wrong). Pass `--call-graph=dwarf` explicitly — confirmed
   this gives real, correct stacks without needing to touch
   `-fomit-frame-pointer` at all.

## Running a profile

`tools/lo-profile.sh` (outer repo) wraps all of the above:

```sh
cd repos/lo   # must be run from here - same convention as build.sh/build-module.sh
../../tools/lo-profile.sh <script.js> [duration_seconds=8] [cpu_list=0] [out_prefix=/tmp/lo-profile]
```

It runs `perf record -e cpu-clock -g --call-graph=dwarf` under
`taskset --cpu-list <cpu_list>` for `duration_seconds`, then produces:

- `<out_prefix>.data` — raw `perf.data`, re-analyzable directly with
  `perf report -i ...` / `perf annotate -i ...` for anything the flat
  summary doesn't answer.
- `<out_prefix>.txt` — a flat (`--no-children`) self-time report, top
  60 lines.
- `<out_prefix>.svg` — a flame graph, rendered by `tools/flamegraph.js`
  (see below).

It does **not** rebuild anything for you — build with symbols first
(previous section), then profile whatever's on disk.

**Isolating one code path**: `bench-abi.js`-style scripts that
alternate between multiple benchmarks make it hard to land samples on
the one you care about within a short recording window. Write a
throwaway script that calls only the target in a tight loop instead
(e.g. `prof-foo-abi.js`: `for (let i = 0; i < 5e9; i++) foo_abi.noop()`)
and point the profiler at that.

## `tools/flamegraph.js` — why a hand-rolled renderer

No FlameGraph (Brendan Gregg's Perl scripts) checkout exists in this
sandbox, and network-fetching one for a ~150-line job wasn't worth the
dependency. `tools/flamegraph.js` (plain Node, ESM) does both steps
Brendan Gregg's `stackcollapse-perf.pl` + `flamegraph.pl` split across
two files, in one:

```sh
perf script -i perf.data > perf-script.txt
node tools/flamegraph.js perf-script.txt out.svg              # render
node tools/flamegraph.js perf-script.txt out.folded --fold-only  # just fold, e.g. to feed another tool
```

Output is a single self-contained `.svg` (inline `<style>`/`<script>`,
no external resources) — opens directly in a browser via `file://`, or
embeds as-is in an HTML page. Click a frame to zoom into its subtree,
click the background to reset — same interaction model as the classic
Perl tool.

Known limitation: many frames come back as `[unknown]` unless the
*entire* call chain is symbolized, including V8's own JIT-generated
code and glibc/musl internals — this session's captures had real,
useful symbols for the parts that mattered (our own `.so`, V8's public
API surface) with `[unknown]`/raw-address frames elsewhere. Good enough
to answer "where does our own code spend its time," not a complete
whole-process profile.

## Worked example: what this actually found

Profiling `lib/foo_abi`'s `GenericDispatch` (the ABI prototype's
generic V8 dispatch callback, see [WORK.E.1.md](WORK.E.1.md)) on a
zero-argument `noop()` call turned up two real, distinct costs that
guessing from source-reading alone had wrong:

- **Not the bottleneck**: the `switch (desc->nparams)` block that
  dispatches through `desc->fn` as a raw function pointer — looked like
  the obvious suspect (a compiler can never inline through it), but
  measured at only ~2.7% of `GenericDispatch`'s self time.
- **The actual dominant cost (~35-40%)**: `args.Data()` itself.
  `perf annotate`'s disassembly of V8's own
  `v8::api_internal::GetFunctionTemplateData` shows it allocating a
  fresh handle via `HandleScope::ExtendAndCreateHandle` on every single
  call — inherent to using *any* `Data()`-based per-function config
  mechanism (this doesn't care whether the config is stashed via
  `v8::External` or an internal field; both need `Data()` first).
- **A real, fixed inefficiency (~14-16% of self time, unrelated to the
  above)**: a fixed `std::unique_ptr<String::Utf8Value> strings[kMaxArgs]`
  array paid for six unconditional destructor checks on *every* call
  regardless of `nparams`, even for a function that takes no arguments
  at all. Fixed by switching to `lib/core/api.js`'s own established
  `strdup`/`free`-with-counter pattern (bounded by how many string args
  a given call actually had, not the fixed max arity).

Full flame graph and breakdown table published as an artifact during
the session that produced this doc — regenerate with the "Reproduce
it" commands above if it's not still live.

## Follow-up: reading generated code directly with `objdump`

Once `args.Data()` was eliminated (confirmed separately, by direct A/B
measurement: storing the descriptor in a `static` variable rather than
fetching it via `Data()` dropped a 0-arg call from ~17ns to ~12ns,
against a hand-generated baseline of ~8ns), the next question — where
does the remaining ~4ns/50% overhead come from — didn't need a fresh
`perf` recording at all. A live sampling profile answers "where does
time go across many calls"; for "why does *this one function's*
compiled code look different from *that one*," reading the actual
disassembly directly is faster and more precise. No profiling run
needed — just the same symbol-preserving build from "Two build-side
requirements" above, plus `objdump`.

```sh
# 1. Build with symbols kept (same requirement as perf-based profiling)
LARGS='-fno-exceptions -O3' LO_CACHE=1 NOGEN=1 ./build-module.sh foo_abi

# 2. Disassemble the function in question, demangling C++ names (-C)
objdump -d -C lib/foo_abi/foo_abi.so | grep -A 60 "<.*GenericDispatch.*>:"

# 3. Disassemble the hand-generated comparison point from the *other*
#    binding's .so, for a direct side-by-side
objdump -d -C lib/foo/foo.so | grep -A 20 "<lo::foo::noopSlow"
```

What this found: `noopSlow` (step 3) compiles to a single `ret` — the
compiler inlined away `noop()`'s empty body entirely, so there is no
function body to speak of; the ~8ns baseline is purely V8's own cost of
invoking a bound `FunctionCallback`, not anything `noopSlow` itself
does. `GenericDispatch` (step 2), even with `Data()` gone, has this
prologue on *every* call regardless of which branch runs:

```
push %rbp; push %r15; push %r14; push %r13; push %r12; push %rbx
sub  $0x88,%rsp                ; 136 bytes of stack
mov  %fs:0x28,%rax             ; stack-protector canary read
mov  %rax,0x80(%rsp)           ; canary stored
```

— six callee-saved register pushes, a 136-byte stack frame, and a
stack-smashing canary, all paid before the function has even read
`nparams` to decide which branch to take. The compiler sizes a
function's prologue/epilogue for its *entire* body (the multi-arg/
string-handling branch needs several live registers and local arrays,
which is what triggers the stack-protector canary in the first place),
not the branch actually taken at runtime — it did not shrink-wrap the
register saves into only the slow path. This is the concrete mechanism
behind "a big function makes even its trivial paths expensive": the
fix is splitting the trivial-shape case into its own minimal dispatch
function (chosen per descriptor at *registration* time, based on its
known `nparams`/`result` shape, not branched on at every call) rather
than widening one monolithic dispatcher.
