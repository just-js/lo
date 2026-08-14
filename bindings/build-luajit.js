// Driver for lib/luajit/build.js, run via /root/lo. Only used here for
// its fetch step - build.js sets CFLAGS via an environment variable
// (exec_env), which LuaJIT's own Makefile can still override internally
// for -fPIC specifically (confirmed: default build.js invocation
// produces a non-PIC libluajit.a, unusable in a shared object). The
// Makefile redoes the actual `make` step right after this with CFLAGS
// passed as a real command-line override instead - see the luajit
// target in Makefile.
const { build } = await import('lib/luajit/build.js')
await build()
console.log('luajit fetch/build done (Makefile rebuilds with correct PIC flags next)')
