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

## abi.js

correctness tests for the lo_abi.h prototype (see doc/WORK.E.1.md/
doc/PROFILING.md) against lib/foo_abi, covering both the slow-call
dispatch tiers and the V8 Fast API Call path (via warmup loops, since
V8 only takes the fast path once a call site is actually optimized).
foo_abi/noop/add1 are the prototype's current names, expected to be
renamed/refactored as the ABI work generalizes.

```shell
lo test/abi.js
```
