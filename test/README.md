# test

this folder contains tests and benchmarks for the lo runtime

## runtime.js

this does a basic sanity check on the runtime and dumps some diagnostic info
on the console

```shell
lo test/runtime.js
```

## dump.js

this iterates over all the builtins and bindings in the runtime and dumps
them on the console

```shell
lo test/dump.js
```

## dump-binding.js

this will load the binding specified and dump the api to the console

```shell
lo test/dump-binding.js core
```

## timer.js

this will test the lib/timer.js is working as expected

```shell
lo test/timer.js
```

## build.js

this will test building core modules and runtimes is working as expected

```shell
lo test/build.js
```

## isolates.js

this spawns isolates one after another in a tight loop (lib/worker.js, one
thread per isolate) and fails if RSS keeps growing per isolate after a
warm-up. it takes ~45 seconds with the defaults. set ISOLATES_WARMUP,
ISOLATES_COUNT, ISOLATES_SAMPLE and ISOLATES_MAX_SLOPE (bytes per isolate)
to change them

```shell
lo test/isolates.js
make check-isolates
```

## strings/

tests and benchmarks for passing strings between JS and C: generated bindings
(fast and slow calls), lib/ffi.js `string` parameters, and the string
intrinsics (utf8Encode, utf8EncodeInto, utf8Length, cstr, TextEncoder,
utf8Decode, latin1Decode, TextDecoder). every route should give C the
string's UTF-8 bytes, NUL-terminated where C expects a C string, and decode
C's bytes as UTF-8. run from the repo root with a full V8 build (fast calls
need TurboFan)

- `encode.js`: JS -> C. lengths and exact bytes per route, for sequential,
  cons and sliced strings, Latin-1 (U+0080-U+00FF), two-byte, surrogate
  pairs, an unpaired surrogate, empty and long strings. each check runs in a
  hot loop with Maglev off: iteration 0 is the slow path, later iterations
  the fast path, and a failure says which
- `decode.js`: C -> JS. utf8Decode/TextDecoder against the WHATWG decoder
  (U+FFFD for invalid input), latin1Decode, encode -> decode round trips, and
  a real directory: names from readdir_sync must stat() as themselves
- `bench.js`: ns per call per route, kind and length. run it with and without
  `--no-turbo-fast-api-calls`: equal numbers mean no fast path
- `common.js`: the reference UTF-8 encoder, the string kinds and helpers

`--no-fast` turns fast calls off for encode.js and decode.js. both exit 1 on
any failure and clean up their directories in /tmp. as of 2026-11-08 they fail:
the fast path passes unterminated Latin-1 (PLAN task 144 in the claude repo),
and the intrinsics encode Latin-1 and unpaired surrogates wrongly (task 138)

```shell
./lo test/strings/encode.js [--no-fast] [iterations]
./lo test/strings/decode.js [--no-fast] [iterations]
./lo test/strings/bench.js [filter]
./lo --no-turbo-fast-api-calls test/strings/bench.js [filter]
```
