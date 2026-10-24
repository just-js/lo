// Bun's TypeScript type checker (`bun check`, oven-sh/bun src/sema), through the C ABI library of
// github.com/just-js/ts-sema. build.js turns its static library into ts_sema.o.
const api = {
  // char *bun_sema_check(const char *project, const char *ts_lib_dir, uint32_t threads, size_t *len)
  // project: a tsconfig.json or its directory; ts_lib_dir: the lib.*.d.ts files; threads 0: one per core.
  // Returns a NUL-terminated JSON report of *len bytes, to be freed with free below (bun_sema_free), never libc free().
  check: {
    parameters: ['pointer', 'pointer', 'u32', 'buffer'],
    pointers: ['const char*', 'const char*', , 'size_t*'],
    result: 'pointer',
    rpointer: 'char*',
    name: 'bun_sema_check'
  },
  free: {
    parameters: ['pointer'],
    pointers: ['char*'],
    result: 'void',
    name: 'bun_sema_free'
  }
}

const name = 'sema'
const includes = ['ts_sema.h']
const obj = ['ts_sema.o']
// The built-in lib.*.d.ts files are zstd frames (Bun's typescript_libs.bin).
const libs = ['zstd']

export { name, api, includes, obj, libs }
