// Driver for lib/md4c/build.js, run via /root/lo. build.js's second
// (static) cmake pass doesn't set CMAKE_POSITION_INDEPENDENT_CODE, so
// the resulting libmd4c.a/libmd4c-html.a aren't PIC - fine for a static
// binary, not for linking into this addon's shared object. The
// Makefile redoes just that reconfigure+rebuild step with PIC forced
// right after this runs - see the md4c target in Makefile.
const { build } = await import('lib/md4c/build.js')
await build()
console.log('md4c build done')
