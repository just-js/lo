const libs = [
  'lib/ffi.js',
  'lib/proc.js',
  'lib/bench.js',
  'lib/asm.js',
  'lib/asm/x64.js',
  'lib/asm/compiler.js',
  'lib/fs.js',
]

const bindings = [
  'core',
  'boringssl',
  'ada',
  'curl',
  'heap',
  'md4c',
  // 'python' - deliberately excluded for now, see PLAN.md task 20 Phase 2
  'luajit',
]

export { libs, bindings }
