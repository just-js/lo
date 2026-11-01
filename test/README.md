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
