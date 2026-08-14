// Driver for lib/ada/build.js, run via /root/lo. ada's build() takes
// explicit CC/CXX parameters (unlike md4c/luajit/boringssl, which only
// read them from the environment) - pass them straight through with
// --sysroot baked in, exactly the escape hatch the function signature
// is there for. Needs python3 for the upstream amalgamate.py step (see
// PLAN.md task 20 / alpine-packages.log).
const TC = lo.getenv('TC') || '/root/demo/alpine-toolchain/root'
const { build } = await import('lib/ada/build.js')
await build(`gcc --sysroot=${TC}`, `g++ --sysroot=${TC}`)
console.log('ada build done')
