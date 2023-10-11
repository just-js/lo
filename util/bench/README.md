to install other runtimes for benchmarks on gitpod

```bash
#!/bin/bash
if ! command -v bun &> /dev/null
then
    echo installing bun
    curl -fsSL https://bun.sh/install | bash
    source /home/gitpod/.bashrc
fi
if ! command -v bun &> /dev/null
then
    echo installing deno
    curl -fsSL https://deno.land/x/install/install.sh | sh
    export DENO_INSTALL="/home/gitpod/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"
fi
nvm install 20
nvm use 20
```

11 oct 2023 on gitpod, best results seen

```bash
nice -n 20 taskset --cpu-list 0 hyperfine --warmup 50 "bun hello.mjs"
Benchmark 1: bun hello.mjs
  Time (mean ± σ):      22.5 ms ±   2.1 ms    [User: 15.4 ms, System: 6.9 ms]
  Range (min … max):    19.9 ms …  34.0 ms    121 runs

nice -n 20 taskset --cpu-list 0 hyperfine --warmup 50 "deno run -A hello.mjs"
Benchmark 1: deno run -A hello.mjs
  Time (mean ± σ):      27.1 ms ±   2.2 ms    [User: 15.8 ms, System: 10.8 ms]
  Range (min … max):    24.1 ms …  44.2 ms    101 runs

nice -n 20 taskset --cpu-list 0 hyperfine --warmup 50 "node hello.mjs"
Benchmark 1: node hello.mjs
  Time (mean ± σ):      37.9 ms ±   2.3 ms    [User: 26.7 ms, System: 26.6 ms]
  Range (min … max):    33.3 ms …  43.1 ms    73 runs

nice -n 20 taskset --cpu-list 0 hyperfine --warmup 50 "./spin hello.mjs"
Benchmark 1: ./spin hello.mjs
  Time (mean ± σ):       4.1 ms ±   0.5 ms    [User: 3.3 ms, System: 1.1 ms]
  Range (min … max):     3.3 ms …   8.0 ms    510 runs

nice -n 20 taskset --cpu-list 0 hyperfine --warmup 50 "./spin hello.mjs"
Benchmark 1: ./spin hello.mjs
  Time (mean ± σ):       5.8 ms ±   0.8 ms    [User: 3.7 ms, System: 2.3 ms]
  Range (min … max):     4.7 ms …  11.9 ms    294 runs
```
