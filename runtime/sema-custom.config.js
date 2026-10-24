// sema-custom: sema-tsc (runtime/sema-tsc.js) with its own TypeScript lib files embedded, which replace the built-in
// set, so only those standards type check (e.g. ES2022 without DOM: `console`, `fetch`, `document` are then errors
// unless a project declares them). The files are every lib.*.d.ts in SEMA_LIBS (default runtime/sema-libs), written
// by ts-sema's libs.js from its built-in set, so they match the checker's TypeScript version:
//   node <ts-sema>/libs.js runtime/sema-libs es2022     (any tsconfig "lib" names; what they reference comes too)
//   ./build.sh sema-custom
import { readdir_sync, isDir } from 'lib/fs.js'
import base from 'runtime/sema-tsc.config.js'

const libs_dir = lo.getenv('SEMA_LIBS') || 'runtime/sema-libs'
if (!isDir(libs_dir)) throw new Error(`sema-custom: no ${libs_dir}; write a lib set with ts-sema's libs.js`)
const embeds = readdir_sync(libs_dir)
  .filter(entry => entry.isFile && /^lib\..+\.d\.ts$/.test(entry.name))
  .map(entry => `${libs_dir}/${entry.name}`)
  .sort()
if (!embeds.length) throw new Error(`sema-custom: no lib.*.d.ts files in ${libs_dir}`)

export default { ...base, embeds, target: 'sema-custom' }
