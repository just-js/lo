// Driver for lib/boringssl/build.js, run via /root/lo (not node - needs
// lo's lib/curl.js-backed fetch()). Unlike md4c/luajit, boringssl's own
// build.js already passes -DCMAKE_POSITION_INDEPENDENT_CODE=ON for its
// static build, so no PIC workaround is needed here - just the sysroot
// (via CFLAGS/CXXFLAGS env, picked up by cmake's initial configure).
const { build } = await import('lib/boringssl/build.js')
await build()
console.log('boringssl build done')
