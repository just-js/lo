/*
this runs on bun/lo/deno/node on macos and linux
need to test on windows
*/

function is_a_tty(fd = 1) {
  if (globalThis.Deno) return Deno.isatty(fd);
  if (globalThis.lo) return lo.core.isatty(fd);
  if (fd === 1) return process.stdout.isTTY;
  if (fd === 2) return process.stderr.isTTY;
  return process.stdin.isTTY;
}

const isatty = is_a_tty();

const AD = isatty ? "\u001b[0m" : ""; // ANSI Default
const A0 = isatty ? "\u001b[30m" : ""; // ANSI Black
const AR = isatty ? "\u001b[31m" : ""; // ANSI Red
const AG = isatty ? "\u001b[32m" : ""; // ANSI Green
const AY = isatty ? "\u001b[33m" : ""; // ANSI Yellow
const AB = isatty ? "\u001b[34m" : ""; // ANSI Blue
const AM = isatty ? "\u001b[35m" : ""; // ANSI Magenta
const AC = isatty ? "\u001b[36m" : ""; // ANSI Cyan
const AW = isatty ? "\u001b[37m" : ""; // ANSI White

const colors = { AD, AG, AY, AM, AD, AR, AB, AC, AW, A0 };
const decoder = new TextDecoder();
const encoder = new TextEncoder();

class Stats {
  recv = 0;
  send = 0;
  conn = 0;
  rps = 0;

  log() {
    const { send, recv, conn, rps } = this;
    const [usr, sys] = cputime();
    console.log(
      `${AC}send${AD} ${to_size_string(send)} ${AC}recv${AD} ${to_size_string(recv)} ${AC}rps${AD} ${rps} ${AC}rss${AD} ${mem()} ${AC}con${AD} ${conn} ${AY}usr${AD} ${usr.toString().padStart(3, " ")} ${AY}sys${AD}  ${sys.toString().padStart(3, " ")} ${AY}tot${AD} ${(usr + sys).toString().padStart(3, " ")}`,
    );
    this.send = this.recv = this.rps = 0;
  }

  get runtime() {
    return lo.hrtime() - lo.start;
  }
}

function pad(v, size, precision = 0) {
  return v.toFixed(precision).padStart(size, " ");
}

function memory_usage(buf) {
  return Math.floor(Number(decoder.decode(buf).split(" ")[23]) * 4096);
}

let lastusr = 0;
let lastsys = 0;
let last_time = Date.now();

function cpu_usage(bytes) {
  const str = decoder.decode(bytes);
  const parts = str.split(" ");
  const elapsed = Date.now() - last_time;
  const usr = Number(parts[13]);
  const sys = Number(parts[14]);
  const res = [(((usr - lastusr) * 10) / elapsed) * 100, (((sys - lastsys) * 10) / elapsed) * 100];
  lastusr = usr;
  lastsys = sys;
  last_time = Date.now();
  return res;
}

async function wrap_mem_usage() {
  if (globalThis.Deno) {
    if (Deno.build.os === "linux") {
      const mem = () => memory_usage(Deno.readFileSync("/proc/self/stat"));
      const cputime = () => cpu_usage(Deno.readFileSync("/proc/self/stat"));
      cputime();
      return { mem, cputime };
    }
    const mem = () => Deno.memoryUsage().rss;
    const _SC_CLK_TCK = 3;
    const api = Deno.dlopen("libc.dylib", {
      sysconf: { parameters: ["i32"], result: "i32" },
      times: { parameters: ["buffer"], result: "i32" },
    }).symbols;
    const { sysconf, times } = api;
    const clock_ticks_per_second = sysconf(_SC_CLK_TCK);
    const last = new Int32Array(5);
    const current = new Int32Array(6);
    current[5] = clock_ticks_per_second;
    const time32 = new Uint32Array(9);
    const _cputime = () => {
      time32[4] = times(time32);
      for (let i = 0; i < 5; i++) {
        current[i] = time32[i] - last[i];
        last[i] = time32[i];
      }
      return current;
    };
    _cputime();
    return {
      mem,
      cputime: () => {
        const time = _cputime();
        const usr = time[0] / (time[4] / time[5]);
        const sys = time[2] / (time[4] / time[5]);
        return [usr, sys];
      },
    };
  }
  if (globalThis.process && !globalThis.lo) {
    const os = await import("os");
    if (os.platform() === "linux") {
      const fs = await import("fs");
      const mem = () => memory_usage(fs.readFileSync("/proc/self/stat"));
      const cputime = () => cpu_usage(fs.readFileSync("/proc/self/stat"));
      cputime();
      return { mem, cputime };
    }
    let prev = process.cpuUsage();
    let since = Date.now();
    return {
      mem: () => process.memoryUsage().rss,
      cputime: () => {
        const now = Date.now();
        const elapsed_ms = now - since;
        const cpu = process.cpuUsage();
        const user = cpu.user - prev.user;
        const system = cpu.system - prev.system;
        prev = cpu;
        const usr = (user / 1000 / elapsed_ms) * 100;
        const sys = (system / 1000 / elapsed_ms) * 100;
        since = Date.now();
        return [usr, sys];
      },
    };
  }
  if (globalThis.lo) {
    const proc = await import("lib/proc.js");
    proc.cputime();
    const cputime = () => {
      const time = proc.cputime();
      const usr = time[0] / (time[4] / time[5]);
      const sys = time[2] / (time[4] / time[5]);
      return [usr, sys];
    };
    return { mem: proc.mem, cputime };
  }
}

function to_size_string(bytes) {
  if (bytes < 1000) {
    return `${bytes.toFixed(2).padStart(8, " ")} ${AY} Bps${AD}`;
  } else if (bytes < 1000 * 1000) {
    return `${(Math.floor((bytes / 1000) * 100) / 100).toFixed(2).padStart(8, " ")} ${AY}KBps${AD}`;
  } else if (bytes < 1000 * 1000 * 1000) {
    return `${(Math.floor((bytes / (1000 * 1000)) * 100) / 100).toFixed(2).padStart(8, " ")} ${AY}MBps${AD}`;
  }
  return `${(Math.floor((bytes / (1000 * 1000 * 1000)) * 100) / 100).toFixed(2).padStart(8, " ")} ${AY}GBps${AD}`;
}

function formatNanos(nanos) {
  if (nanos >= 1000000000) return `${AY}sec/iter${AD} ${pad(nanos / 1000000000, 10, 2)}`;
  if (nanos >= 1000000) return `${AY}ms/iter${AD} ${pad(nanos / 1000000, 10, 2)}`;
  if (nanos >= 1000) return `${AY}μs/iter${AD} ${pad(nanos / 1000, 10, 2)}`;
  return `${AY}ns/iter${AD} ${pad(nanos, 10, 2)}`;
}

function bench(name, fn, count, after = noop) {
  const start = performance.now();
  for (let i = 0; i < count; i++) fn();
  const elapsed = performance.now() - start;
  const rate = Math.floor(count / (elapsed / 1000));
  const nanos = 1000000000 / rate;
  const rss = mem();
  console.log(
    `${name.slice(0, 32).padEnd(17, " ")} ${pad(Math.floor(elapsed), 6)} ms ${AG}rate${AD} ${pad(rate, 10)} ${formatNanos(nanos)} ${AG}rss${AD} ${rss}`,
  );
  after();
  return { name, count, elapsed, rate, nanos, rss, runtime };
}

async function benchAsync(name, fn, count, after = noop) {
  const start = performance.now();
  for (let i = 0; i < count; i++) await fn();
  const elapsed = performance.now() - start;
  const rate = Math.floor((count / (elapsed / 1000)) * 100) / 100;
  const nanos = 1000000000 / rate;
  const rss = mem();
  console.log(
    `${name.slice(0, 32).padEnd(17, " ")} ${pad(Math.floor(elapsed), 6)} ms ${AG}rate${AD} ${pad(rate, 10)} ${formatNanos(nanos)} ${AG}rss${AD} ${rss}`,
  );
  after();
  return { name, count, elapsed, rate, nanos, rss, runtime };
}

const runAsync = async (name, fn, count, repeat = 10, after = () => {}) => {
  const runs = [];
  for (let i = 0; i < repeat; i++) {
    runs.push(await benchAsync(name, fn, count, after));
  }
  return runs;
};

const run = (name, fn, count, repeat = 10, after = () => {}) => {
  const runs = [];
  for (let i = 0; i < repeat; i++) {
    runs.push(bench(name, fn, count, after));
  }
  return runs;
};

function arrayEquals(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((val, index) => val === b[index]);
}

class Bench {
  #start = 0;
  #end = 0;
  #name = "bench";
  #display = true;
  #name_width = 20;
  #runtime = "";

  constructor(display = true) {
    this.#display = display;
    this.#runtime = `${runtime.name}_${runtime.version}`
  }

  set name_width(len) {
    this.#name_width = len;
  }

  start(name = "bench") {
    this.#name = name.slice(0, 32).padEnd(32, " ");
    this.#start = performance.now();
  }

  end(count = 0, size = 0) {
    this.#end = performance.now();
    const elapsed = this.#end - this.#start;
    const nanos = Math.floor(elapsed * 1000000);
    const seconds = nanos / 1000000000;
    let rate = count / seconds;
    const rss = mem();
    const [usr, sys] = cputime();
    const total = usr + sys;
    const rate_pc_f = rate / (total / 100);
    const rate_pc = rate_pc_f > 100 ? Math.ceil(rate_pc_f) : Math.ceil(rate_pc_f * 100) / 100;
    const ns_iter = Math.floor((nanos / count) * 100) / 100;
    rate = rate > 100 ? Math.ceil(rate) : Math.ceil(rate * 100) / 100;
    if (this.#display) {
      if (size) {
        console.log(
          `${AC}${this.#runtime.padEnd(16, " ")}${AD} ${AM}${this.#name.trim().padEnd(this.#name_width, " ")}${AD} ${AY}time${AD} ${Math.floor(elapsed).toString().padStart(8, " ")} ${AY}rate${AD} ${rate.toString().padStart(12, " ")} ${AM}rate/core${AD} ${rate_pc.toString().padStart(12, " ")} ${AG}ns/iter${AD} ${ns_iter.toFixed(2).padStart(12, " ")} ${AG}rss${AD} ${rss.toString().padStart(12, " ")} ${AG}usr${AD} ${usr.toFixed(2).padStart(6, " ")} ${AR}sys${AD} ${sys.toFixed(2).padStart(6, " ")} ${AY}tot${AD} ${total.toFixed(2).padStart(6, " ")} ${AG}thru${AD} ${to_size_string(rate_pc * size).padStart(12, " ")}`,
        );
      } else {
        console.log(
          `${AC}${this.#runtime.padEnd(16, " ")}${AD} ${AM}${this.#name.trim().padEnd(this.#name_width, " ")}${AD} ${AY}time${AD} ${Math.floor(elapsed).toString().padStart(8, " ")} ${AY}rate${AD} ${rate.toString().padStart(12, " ")} ${AM}rate/core${AD} ${rate_pc.toString().padStart(12, " ")} ${AG}ns/iter${AD} ${ns_iter.toFixed(2).padStart(12, " ")} ${AG}rss${AD} ${rss.toString().padStart(12, " ")} ${AG}usr${AD} ${usr.toFixed(2).padStart(6, " ")} ${AR}sys${AD} ${sys.toFixed(2).padStart(6, " ")} ${AY}tot${AD} ${total.toFixed(2).padStart(6, " ")}`,
        );
      }
    }
    return { name: this.#name.trim(), count, elapsed, rate, nanos, rss, runtime, usr, sys, rate_pc, ns_iter, seconds };
  }
}

const runtime = { name: "", version: "" };

if (globalThis.Deno) {
  globalThis.args = Deno.args;
  runtime.name = "deno";
  runtime.version = Deno.version.deno;
  runtime.v8 = Deno.version.v8;
  globalThis.readFileAsText = async fn => decoder.decode(Deno.readFileSync(fn));
  globalThis.readFileAsBytes = async fn => Deno.readFileSync(fn);
  globalThis.writeFileAsText = async (fn, str) => Deno.writeFileSync(fn, encoder.encode(str));
  globalThis.writeFileAsBytes = async (fn, u8) => Deno.writeFileSync(fn, u8);
  const fs = await import("node:fs");
  globalThis.openSync = fs.openSync;
  globalThis.readSync = fs.readSync;
  globalThis.closeSync = fs.closeSync;
  globalThis.readFileSync = fs.readFileSync;
  globalThis.process = await import('node:process')
  const { Buffer } = await import('node:buffer')
  globalThis.Buffer = Buffer
} else if (globalThis.lo) {
  globalThis.performance = { now: () => lo.hrtime() / 1000000 };
  globalThis.assert = lo.assert;
  globalThis.args = lo.args.slice(2);
  runtime.name = "lo";
  runtime.version = lo.version.lo;
  runtime.v8 = lo.version.v8;
  const { readFile, writeFile } = lo.core;
  const { close, open, read, O_RDONLY } = lo.core;
  globalThis.readFileAsText = async fn => decoder.decode(readFile(fn));
  globalThis.readFileAsBytes = async fn => readFile(fn);
  globalThis.writeFileAsText = async (fn, str) => writeFile(fn, encoder.encode(str));
  globalThis.writeFileAsBytes = async (fn, u8) => writeFile(fn, u8);
  globalThis.openSync = file_name => open(file_name, O_RDONLY);
  globalThis.readSync = (fd, buf) => read(fd, buf, buf.length);
  globalThis.closeSync = fd => close(fd);
  globalThis.readFileSync = readFile;
  globalThis.process = { argv: lo.args }
} else if (globalThis.Bun) {
  globalThis.args = Bun.argv.slice(2);
  runtime.name = "bun";
  runtime.version = Bun.version;
  globalThis.readFileAsText = async fn => await Bun.file(fn).text();
  globalThis.readFileAsBytes = async fn => await Bun.file(fn).bytes();
  globalThis.writeFileAsText = async (fn, str) => Bun.write(fn, str);
  globalThis.writeFileAsBytes = async (fn, u8) => Bun.write(fn, u8);
  const fs = await import("node:fs");
  globalThis.openSync = fs.openSync;
  globalThis.readSync = fs.readSync;
  globalThis.closeSync = fs.closeSync;
  globalThis.readFileSync = fs.readFileSync;
} else if (globalThis.process) {
  globalThis.args = process.argv.slice(2);
  runtime.name = "node";
  runtime.version = process.version;
  runtime.v8 = process.versions.v8;
  const fs = await import("fs");
  globalThis.readFileAsText = async fn => decoder.decode(fs.readFileSync(fn));
  globalThis.readFileAsBytes = async fn => fs.readFileSync(fn);
  globalThis.writeFileAsText = async (fn, str) => fs.writeFileSync(fn, encoder.encode(str));
  globalThis.writeFileAsBytes = async (fn, u8) => fs.writeFileSync(fn, u8);
  globalThis.openSync = fs.openSync;
  globalThis.readSync = fs.readSync;
  globalThis.closeSync = fs.closeSync;
  globalThis.readFileSync = fs.readFileSync;
}

globalThis.colors = colors;
globalThis.arrayEquals = arrayEquals;

const noop = () => {};
const { mem, cputime } = await wrap_mem_usage();

if (!globalThis.assert) {
  function assert(condition, message, ErrorType = Error) {
    if (!condition) {
      throw new ErrorType(message || "Assertion failed");
    }
  }

  globalThis.assert = assert;
}

const measure = {
  start: () => {
    cputime();
    measure._start = performance.now();
  },
  end: (count) => {
    const nanos = Math.floor((performance.now() - measure._start) * 1000000);
    const elapsed = nanos / 1000000;
    const seconds = nanos / 1000000000;
    let rate = count / seconds;
    const rss = mem();
    const [usr, sys] = cputime();
    const total = usr + sys;
    const rate_pc_f = rate / (total / 100);
    const rate_pc = rate_pc_f > 100 ? Math.ceil(rate_pc_f) : Math.ceil(rate_pc_f * 100) / 100;
    const ns_iter = Math.floor((nanos / count) * 100) / 100;
    rate = rate > 100 ? Math.ceil(rate) : Math.ceil(rate * 100) / 100;
    return { rss, usr, sys, total, elapsed, rate, rate_pc, ns_iter }
  },
  log: (count = 0) => {
    const { rss, usr, sys, total, elapsed, rate, rate_pc, ns_iter } = measure.end(count);
    console.log(
      `${AY}time${AD} ${Math.floor(elapsed).toString().padStart(8, " ")} ${AY}rate${AD} ${rate.toString().padStart(12, " ")} ${AM}rate/core${AD} ${rate_pc.toString().padStart(12, " ")} ${AG}ns/iter${AD} ${ns_iter.toFixed(2).padStart(12, " ")} ${AG}rss${AD} ${rss.toString().padStart(12, " ")} ${AG}usr${AD} ${usr.toFixed(2).padStart(6, " ")} ${AR}sys${AD} ${sys.toFixed(2).padStart(6, " ")} ${AY}tot${AD} ${total.toFixed(2).padStart(6, " ")}`,
    );
    measure.start();
  },
};

export {
  pad,
  formatNanos,
  colors,
  run,
  runAsync,
  Bench,
  mem,
  runtime,
  to_size_string,
  Stats,
  cputime,
  measure,
  is_a_tty,
  cpu_usage,
  memory_usage,
};
