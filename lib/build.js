import { is_file, is_dir, mkdir_all_safe } from 'lib/fs.js'
import { inflate } from 'lib/inflate.js'
import { fetch } from 'lib/curl.js'
import { untar } from 'lib/untar.js'
import {
  bindings, linkerScript, headerFile, config, linkArgs, libPaths
} from 'lib/gen.js'
import { exec } from 'lib/proc.js'
import { fileName, extName, join, baseName } from 'lib/path.js'

const { core, getenv, getcwd, assert, colors } = lo
const { AM, AY, AG, AD } = colors
const {
  write_file, chdir, mkdir, read_file, unlink, rename,
  S_IXOTH, S_IRWXU, S_IRWXG, S_IROTH, defaultWriteFlags
} = core

function exec2 (args, verbose = false) {
  if (verbose) console.log(args.join(' '))
  exec(args[0], args.slice(1), status)
  assert(status[0] === 0)
}

async function create_lo_home () {
  if (!is_file(join(LO_HOME, 'main.h'))) {
    mkdir_all_safe(LO_HOME)
    const dl_path = join(LO_HOME, '..')
    assert(chdir(dl_path) === 0)
    const file_name = 'lo.tar.gz'
    const url = `https://codeload.github.com/${org}/${project}/tar.gz/${VERSION}`
    console.log(`${AM}create LO_HOME in ${AD} ${LO_HOME}`)
    console.log(`${AY}download lo source from ${url} for version ${AD}${VERSION}`)
    const size = fetch(url, file_name)
    assert(size > 0)
    console.log(`${AY}downloaded${AD} ${file_name} ${AG}size${AY} ${size}`)
    const bytes = read_file(file_name)
    assert(bytes.length === size)
    untar(inflate(bytes))
    unlink(file_name)
    assert(is_dir(`${project}-${VERSION}`))
    rename(`${project}-${VERSION}`, '.lo')
    assert(is_dir(LO_HOME))
    assert(chdir(cwd) === 0)
  }
  const v8_dir = join(LO_HOME, 'v8/include')
  if (!is_dir(v8_dir)) {
    console.log(`${AM}creating${AD} ${v8_dir}`)
    assert(chdir(LO_HOME) === 0)
    const file_name = 'include.tar.gz'
    console.log(`${AY}download v8 includes for version ${AD}${v8}`)
    const size = fetch(`${v8_url_prefix}/${v8}/include.tar.gz`, file_name)
    assert(size > 0)
    console.log(`${AY}downloaded${AD} ${file_name} ${AG}size${AY} ${size}`)
    const bytes = read_file(file_name)
    assert(bytes.length === size)
    untar(inflate(bytes))
    unlink(file_name)
    assert(is_dir(v8_dir))
    assert(chdir(cwd) === 0)
  }
  const v8_lib = join(LO_HOME, `v8/libv8_monolith.a`)
  if (!is_file(v8_lib)) {
    console.log(`${AM}creating${AD} ${v8_lib}`)
    assert(chdir(LO_HOME) === 0)
    if (V8_LIB) {
      assert(is_file(V8_LIB))
      const bytes = read_file(V8_LIB)
      assert(bytes.length > 0)
      assert(write_file('v8/libv8_monolith.a', bytes) === bytes.length)
    } else {
      assert(chdir(LO_HOME) === 0)
      const file_name = `libv8_monolith-${os}-${arch}.a.gz`
      console.log(`${AY}download v8 static lib for version ${AD}${v8}`)
      const size =
        fetch(`${v8_url_prefix}/${v8}/libv8_monolith-${os}-${arch}.a.gz`,
        file_name)
      assert(size > 0)
      console.log(`${AY}downloaded${AD} ${file_name} ${AG}size${AY} ${size}`)
      const bytes = read_file(file_name)
      assert(bytes.length === size)
      const inflated = inflate(bytes)
      assert(write_file('v8/libv8_monolith.a', inflated) === inflated.length)
      unlink(file_name)
    }
    assert(is_file(v8_lib))
    assert(chdir(cwd) === 0)
  }
}

// todo: change these methods to accept objects, not filenames
async function compile_bindings (lib, verbose = false, opt = OPT, shared = true) {
  const cwd = getcwd()
  check_compilers()
/*
todo: check here if we have existing lib in LO_HOME and use that if so
todo: also try to fetch from github if not found in LO_HOME

*/
  const lib_dir = `lib/${lib}`
  const binding_path = `${lib_dir}/api.js`
  const build_path = `${lib_dir}/build.js`
  if (!is_dir(lib_dir)) {
    console.log(`${AM}create dir${AD} ${lib_dir}`)
    mkdir_all_safe(`${lib_dir}`)
  }

  if (!is_file(binding_path)) {
    console.log(`${AM}create bindings def at ${AD} ${binding_path}`)
    write_file(`${binding_path}`, read_file(join(LO_HOME, binding_path)))
  }

  if (!is_file(build_path) && is_file(join(LO_HOME, build_path))) {
    console.log(`${AM}create bindings build at ${AD} ${build_path}`)
    write_file(`${build_path}`, read_file(join(LO_HOME, build_path)))
  }
  const def = await import(binding_path)
  const src = bindings(def)
  const prefix = PREFIX || (def[os] ? def[os].prefix : '')
  let { obj = [], libs = [], lib_paths = [], include_paths = [] } = def
  if (def[os] && def[os].obj?.length) {
    obj = obj.concat(def[os].obj)
  }
  if (def[os] && def[os].libs?.length) {
    libs = libs.concat(def[os].libs)
  }
  if (def[os] && def[os].lib_paths?.length) {
    if (prefix) {
      lib_paths = lib_paths.concat(def[os].lib_paths.map(p => join(prefix, p)))
    } else {
      lib_paths = lib_paths.concat(def[os].lib_paths)
    }
  }
  if (def[os] && def[os].include_paths?.length) {
    if (prefix) {
      include_paths = include_paths.concat(def[os].include_paths.map(p => join(prefix, p)))
    } else {
      include_paths = include_paths.concat(def[os].include_paths)
    }
  }
  if (!NOGEN) {
    console.log(`${AY}create ${AD} ${lib_dir}/${def.name}.cc`)
    write_file(`${lib_dir}/${def.name}.cc`, encoder.encode(src))
  }
  if (is_file(build_path)) {
    console.log(`${AM}building dependencies${AD} ${lib} ${AY}in${AD} ${lib_dir}`)
    const { build } = await import (build_path)
    console.log(`${AY}change dir to ${AD} ${lib_dir}`)
    assert(chdir(lib_dir) === 0)
    await build(CC, CXX)
  } else {
    console.log(`${AY}change dir to ${AD} ${lib_dir}`)
    assert(chdir(lib_dir) === 0)
  }
  console.log(`${AY}compile${AD} ${def.name}.cc ${AY}with${AG} ${CXX}${AD}`)
  unlink(`${def.name}.o`)
  exec2([...CXX.split(' '), ...CFLAGS, ...opt.split(' '), `-I${LO_HOME}`, `-I${LO_HOME}/v8`,
    ...include_paths.map(p => `-I${p}`), '-I.', `-I${LO_HOME}/v8/include`,
    `-I${lib_dir}`, ...WARN, '-o', `${def.name}.o`, `${def.name}.cc`], verbose)

  console.log(`${AY}static lib ${AD} ${def.name}.a`)
  unlink(`${def.name}.a`)
  if (obj && obj.length) {
    exec2(['ar', 'crsT', `${def.name}.a`, `${def.name}.o`,
      ...obj.filter(f => extName(f) === 'o')], verbose)
  } else {
    exec2(['ar', 'crsT', `${def.name}.a`, `${def.name}.o`], verbose)
  }
  if (shared) {
    console.log(`${AY}shared lib ${AD} ${def.name}.so ${AY}with${AG} ${CXX}${AD}`)
    unlink(`${def.name}.so`)
    if (os === 'mac') {
      exec2([...LINK.split(' '), '-bundle_loader', LO_PATH, ...LARGS, ...opt.split(' '), '-bundle', ...WARN, '-o',
        `${def.name}.so`, `${def.name}.o`,
        ...(obj || []),
        ...(libs || []).map(l => `-l${l}`),
        ...(lib_paths || []).map(l => `-L${l}`)],
        verbose)
    } else if (os === 'linux') {
      exec2([...LINK.split(' '), ...LARGS, ...opt.split(' '), '-shared', ...WARN, '-o',
        `${def.name}.so`, `${def.name}.o`,
        ...(obj || []),
        ...(libs || []).map(l => `-l${l}`),
        ...(lib_paths || []).map(l => `-L${l}`)],
        verbose)
    }
  }
  let results = []
  if (obj && obj.length) {
    results = obj.filter(f => extName(f) === 'a').map(f => {
      const lib_path = is_dir(lib_dir) ? join(cwd, lib_dir) : lib_dir
      return f.slice(0, 1) === '/' ? f : `${lib_path}/${f}`
    })
  }
  console.log(`${AY}change dir to ${AD} ${cwd}`)
  assert(chdir(cwd) === 0)
  return results
}

function create_builtins (libs = [], main = 'main.js', os) {
  const cwd = getcwd()
  function verify_path (path) {
    if (cwd !== LO_HOME && is_file(join(cwd, path))) {
      return linkerScript(path, cwd)
    }
    return linkerScript(path)
  }
  config.os = 'linux'
  write_file(`${LO_HOME}/builtins_linux.S`,
    encoder.encode(`${Array.from(new Set([main, ...libs])).map(verify_path).join('')}.section .note.GNU-stack,"",@progbits`))
  config.os = 'mac'
  write_file(`${LO_HOME}/builtins.S`,
    encoder.encode(Array.from(new Set([main, ...libs])).map(verify_path).join('')))
  config.os = os
}

function create_header (libs = [], bindings = [], index = '', main = 'main.js', opts) {
  const rx = /[./-]/g
  const main_name = main.replace(rx, '_')
  let source = `#pragma once
// [do not edit,<auto-generated />]
// This file has been automatically generated, please do not change unless you disable auto-generation in the Makefile

#include "${RUNTIME}.h"

#ifdef _WIN64
#include "builtins.h"
static unsigned int ${main_name}_len = _binary_${main_name}_len;
#else
extern char _binary_${main_name}_start[];
extern char _binary_${main_name}_end[];
static unsigned int ${main_name}_len = _binary_${main_name}_end - _binary_${main_name}_start;
${libs.map(n => `extern char _binary_${n.replace(rx, '_')}_start[];`).join('\n')}
${libs.map(n => `extern char _binary_${n.replace(rx, '_')}_end[];`).join('\n')}

#endif

extern "C" {
  ${bindings.map(b => {
    if (b.constructor.name === 'String') return `extern void* _register_${b}();`
    const name = Object.keys(b)[0]
    const platforms = b[name]
    return platforms.map(p => {
return `
#ifdef ${ifdefs[p]}
  extern void* _register_${name}();
#endif
`
    })
  }).join('\n  ')}
}

void register_builtins() {
  ${RUNTIME}::builtins_add("${main}", _binary_${main_name}_start, _binary_${main_name}_end - _binary_${main_name}_start);
  ${libs.map(n => {
    const name = `_binary_${n.replace(rx, '_')}`
    return `${RUNTIME}::builtins_add("${n}", ${name}_start, ${name}_end - ${name}_start);`
  }).join('\n  ')}
  ${bindings.map(b => {
    if (b.constructor.name === 'String') return `${RUNTIME}::modules_add("${b}", &_register_${b});`
    const name = Object.keys(b)[0]
    const platforms = b[name]
    return platforms.map(p => {
return `
#ifdef ${ifdefs[p]}
  ${RUNTIME}::modules_add("${name}", &_register_${name});
#endif
`
    })

  }).join('\n  ')}
}

${index ? `static const char* index_js = _binary_${index.replace(rx, '_')}_start;
static unsigned int index_js_len = _binary_${index.replace(rx, '_')}_end - _binary_${index.replace(rx, '_')}_start;
` : `static const char* index_js = NULL;
static unsigned int index_js_len = 0;`}

static const char* main_js = _binary_${main_name}_start;
${main !== 'main.js' ? `static unsigned int main_js_len = ${main_name}_len;` : ''}
static const char* v8flags = "${opts.v8flags}";
static unsigned int _v8flags_from_commandline = ${opts.v8flags ? 1 : 0};
static unsigned int _v8_threads = ${opts.v8_threads};
static unsigned int _v8_cleanup = ${opts.v8_cleanup};
static unsigned int _on_exit = ${opts.on_exit};
#ifdef __linux__

#endif
#ifdef __MACH__

#endif
`
  write_file(`${LO_HOME}/main.h`, encoder.encode(source))
}

function check_compilers () {

}

async function build_runtime ({ libs = lo.builtins(), bindings = lo.libraries(),
  embeds = [], target, link_type = LINK_TYPE, opt = OPT,
  v8_opts = {}, index = '', main = 'main.js', link_args = LARGS }, verbose = false) {
  const cwd = getcwd()
  if (index) embeds.push(index)
  if (TARGET) target = TARGET

  const platform_bindings = bindings.map(b => {
    if (b.constructor.name === 'String') return b
    const name = Object.keys(b)[0]
    const platforms = b[name]
    if (platforms.includes(os)) return name
    return ''
  }).filter(b => b)

  Object.assign(defaultOpts, v8_opts)
  console.log(`${AY}create${AD} builtins`)
  create_builtins([...libs, ...embeds], main, config.os)
  console.log(`${AY}create${AD} main header`)
  create_header([...libs, ...embeds], bindings, index, main, defaultOpts)
  check_compilers()
  assert(chdir(LO_HOME) === 0)
  console.log(`${AY}compile${AD} builtins`)
  if (os === 'linux') {
    exec2([...CC.split(' '), '-c', 'builtins_linux.S', '-o', 'builtins.o'], verbose)
  } else if (os !== 'win') {
    exec2([...CC.split(' '), '-c', 'builtins.S', '-o', 'builtins.o'], verbose)
  }
  console.log(`${AY}compile${AD} main.cc`)
  exec2([...CXX.split(' '), `-DRUNTIME="${RUNTIME}"`, `-DVERSION="${VERSION}"`,
    ...CFLAGS, ...opt.split(' '), `-I${LO_HOME}`, `-I${LO_HOME}/v8`,
    '-I.', `-I${LO_HOME}/v8/include`, ...WARN, '-o', 'main.o', 'main.cc'],
    verbose)
  console.log(`${AY}compile${AD} lo.cc`)
  exec2([...CXX.split(' '), `-DRUNTIME="${RUNTIME}"`, `-DVERSION="${VERSION}"`,
    ...CFLAGS, ...opt.split(' '), `-I${LO_HOME}`, `-I${LO_HOME}/v8`,
    '-I.', `-I${LO_HOME}/v8/include`, ...WARN, '-o', `${target}.o`, `lo.cc`],
    verbose)
  console.log(`${AY}link runtime ${AD}`)
  assert(chdir(cwd) === 0)
  let static_libs = platform_bindings.map(n => `lib/${n}/${n}.a`)
/*
  const extra = await Promise.all(platform_bindings.map(binding => compile_bindings(binding, verbose, opt, false)))
  console.log(extra)
  static_libs = static_libs.concat(extra.flat())
  console.log(static_libs)
*/
  for (const binding of platform_bindings) {
    static_libs = static_libs.concat(await compile_bindings(binding, verbose, opt, false))
  }
  static_libs = static_libs.map(f => {
    if (is_file(f)) {
      return join(cwd, f)
    }
    return f
  })
  assert(chdir(LO_HOME) === 0)
  let dynamic_libs = await linkArgs(platform_bindings.map(n => `lib/${n}/api.js`))
  if (link_type.split(' ').includes('-static')) {
    dynamic_libs = dynamic_libs.filter(lib => lib !== '-ldl')
  }
  // todo: this is all just a first pass and quite inefficient, although modules should be cached
  let lib_paths = await libPaths(platform_bindings.map(n => `lib/${n}/api.js`), { prefix: PREFIX })
  let bin = target
  if (cwd !== LO_HOME) bin = `${join(cwd, target)}`
//  exec2([...LINK.split(' '), ...link_args, ...opt.split(' '), ...link_type.split(' '), ...WARN, '-o',
//    `${bin}`, `${target}.o`, 'main.o', 'builtins.o', 'v8/libv8_monolith.a',
//    ...static_libs, ...dynamic_libs, ...lib_paths].filter(v => v).flat(), verbose)
  exec2([...LINK.split(' '), ...link_args, ...link_type.split(' '), ...WARN, '-o',
    `${bin}`, `${target}.o`, 'main.o', 'builtins.o', 'v8/libv8_monolith.a',
    ...static_libs, ...dynamic_libs, ...lib_paths].filter(v => v).flat(), verbose)
  assert(chdir(cwd) === 0)
}

function create_binding (name) {
  return `const api = {
  noop: {
    parameters: [],
    result: 'void'
  }
}

const preamble = [
  'void noop () {',
  '}'
].join('\\n')

const name = '${name}'

const constants = {}

// put comments in here

export { name, api, constants, preamble }
`
}

function generate_config (config) {
  const { embeds = [], bindings = [], libs = [] } = config
  return `
const bindings = [${bindings.map(b => "'" + b + "'").join(',\n')}]
const libs = [${libs.map(l => "'" + l + "'").join(',\n')}]
const embeds = [${embeds.map(l => "'" + l + "'").join(',\n')}]

const target = '${config.target}'
const opt = '${config.opt || '-O3 -march=native -mtune=native'}'

const v8_opts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation'
}

let link_type = '-rdynamic -static-libstdc++'
if (lo.core.os === 'linux') {
  link_type += ' -static-libgcc'
} else if (lo.core.os === 'mac') {
  bindings.push('mach')
}

const index = '${config.index}'
export default { bindings, libs, embeds, target, opt, v8_opts, link_type, index }
`
}

async function build (args) {
  let verbose = false
  if (args.includes('-v')) {
    args = args.filter(a => a !== '-v')
    verbose = true
  }
  await create_lo_home()
  const [ action = 'runtime', name = 'builder' ] = args
  if (action === 'runtime') {
    const config_name = `${name}.config.js`
    if (!is_file(config_name)) {
      if (config_name[0] !== '/' && is_file(join(LO_HOME, config_name))) {
        mkdir_all_safe(baseName(config_name))
        write_file(`${config_name}`, read_file(join(LO_HOME, config_name)))
      } else {
        const config = await import('runtime/base.config.js')
        config.default.target = fileName(name)
        config.default.index = `${config.default.target}.js`
        write_file(config_name, encoder.encode(generate_config(config.default)))
      }
    }
    const runtime_config = await import(config_name)
    await build_runtime(runtime_config.default, verbose)
  } else if (action === 'binding') {
    // todo: check if name is an existing binding and install that if it doesn't exist
    // or maybe this should be a different "add" command?
    const dir_path = `lib/${name}`
    if (!is_dir(dir_path)) {
      mkdir_all_safe(dir_path)
    }
    const file_path = `${dir_path}/api.js`
    if (!is_file(file_path)) {
      write_file(file_path, encoder.encode(create_binding(name)))
    }
    const so_path = `${dir_path}/${name}.${so_ext}`
    if (!is_file(so_path)) {
      if (is_file(`${join(LO_HOME, so_path)}`)) {
        write_file(so_path, read_file(join(LO_HOME, so_path)))
      } else {
        write_file(so_path, encoder.encode(create_binding(name)))
      }
    }
    await compile_bindings(name, verbose)
  } else {
    throw new Error('build command not understood')
  }
}

async function install (args = []) {
  // --docs and --bench for installing docs and bench repos in current dir
  let dest_path = args[0]
  if (!dest_path) {
    const HOME = lo.getenv('HOME')
    if (!HOME) throw new Error('HOME environment variable is not set')
    dest_path = join(HOME, '.lo/bin')
  }
  // we need to download the stdlib and install it in ~/.lo
  mkdir_all_safe(dest_path)
  const file_path = join(dest_path, 'lo')
  write_file(file_path, read_file(LO_PATH), defaultWriteFlags, S_IRWXU | S_IRWXG | S_IROTH)
  console.log(`${AY}lo${AD} has been installed at ${AG}${file_path}${AD}

to add ${AY}${dest_path}${AD} to your system path for this terminal
session. run this export command:

  export PATH="${dest_path}:$PATH"

to add it permanently edit your shell config and add the export.
  `)
}

async function upgrade (args) {
  console.log('upgrade not implemented')
}

async function uninstall (args) {
  console.log('uninstall not implemented')
}

function bootstrap_app_dir (app_name, config) {
  // todo - don't overwrite existing
  write_file('.gitignore', encoder.encode(`.lo
lib/**/*.cc
lib/**/*.o
lib/**/*.a
lib/**/*.so
lib/**/deps
globals.d.ts
tsconfig.json
${app_name}
`))
  // todo: don't overwrite existing
  write_file(`tsconfig.json`, encoder.encode(`{
  "files": ["${config.default.index}"],
  "compilerOptions": {
    "paths": {
      "lib": ["${LO_HOME}/lib"]
    },
    "types": [],
    "target": "es2022",
    "lib": ["es2023"],
    "outDir": "dist",
    "allowJs": true,
    "checkJs": true,
    "strict": true,
    "noImplicitAny": false,
    "isolatedModules": true,
    "noEmit": false,
    "module": "es2022"
  },
  "exclude": ["scratch", "v8", ".vscode", ".git", ".github"],
  "include": ["globals.d.ts", "lib"]
}`))
  // todo: don't overwrite existing
  write_file(`README.md`, encoder.encode(`
# Build
\`\`\`sh
lo build runtime ${app_name}
\`\`\`
# Run
\`\`\`sh
./${app_name}
\`\`\`
  `))
  if (lo.builtins().includes('globals.d.ts')) {
    // todo: don't overwrite existing
    write_file(`globals.d.ts`, encoder.encode(lo.builtin('globals.d.ts')))
  }
}

async function init (args = []) {
  const app_name = args[0] || fileName(lo.getcwd())
  const config = await import('runtime/core.config.js')
  config.default.target = app_name
  config.default.index = `${app_name}.js`
  if (!is_file(`${app_name}.config.js`)) {
    write_file(`${app_name}.config.js`, encoder.encode(generate_config(config.default)))
  }
//  bootstrap_app_dir(app_name, config)
  if (!is_file(`${app_name}.js`)) {
    write_file(`${app_name}.js`, encoder.encode(`console.log('hello')`))
  }
}

const encoder = new TextEncoder()
const status = new Int32Array(2)
const org = getenv('LO_ORG') || 'just-js'
const project = getenv('LO_PROJECT') || 'lo'
const NOGEN = getenv('NOGEN')
const V8_LIB = getenv('LO_V8_LIB')
// todo: clean up api so we can pass a config in and run builds through api
const VERSION = getenv('LO_VERSION') || `${lo.version.lo.split('.').slice(0, 3).join('.')}`
const PREFIX = getenv('LO_PREFIX')
const RUNTIME = getenv('LO_RUNTIME') || 'lo'
const TARGET = getenv('LO_TARGET')
const LINK_TYPE = getenv('LO_LINK_TYPE') || '-rdynamic'
const OPT = getenv('LO_OPT') || '-O3 -march=native -mtune=native'
const WARN = (getenv('LO_WARN') ||
  '-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter').split(' ')
const cwd = getcwd()
const LO_HOME = getenv('LO_HOME') || join(cwd, '.lo')
const v8 = getenv('V8_VERSION') || lo.version.v8.split('.').slice(0, 2).join('.')
const os = getenv('LO_OS') || core.os
const arch = getenv('LO_ARCH') || core.arch
const url_prefix = getenv('LO_URL_PREFIX') || `https://github.com/${org}`
const v8_path = getenv('LO_V8_PATH') || 'v8/releases/download'
const v8_url_prefix = `${url_prefix}/${v8_path}`
// todo: way to override these - usse env?
// todo: only set this if memory is > 16 GB on x86_64
// --huge-max-old-generation-size
let defaultOpts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation',
  prefix: PREFIX
}
// todo: clean this up
let c_compiler = 'gcc'
if (os === 'mac') {
  if (arch === 'arm64') {
    c_compiler = 'clang -arch arm64'
  } else {
    c_compiler = 'clang'
  }
}
let cc_compiler = 'g++'
if (os === 'mac') {
  if (arch === 'arm64') {
    cc_compiler = 'clang++ -arch arm64'
  } else {
    cc_compiler = 'clang++'
  }
}
// todo: allow overriding these
let link_args = '-s'
if (os === 'mac') {
  if (arch === 'arm64') {
    link_args = '-s -arch arm64 -w'
  } else {
    link_args = '-s -w'
  }
} else if (os === 'linux') {
  link_args = '-s -fno-exceptions'
}

const ifdefs = {
  linux: '__linux__',
  mac: '__MACH__',
  win: '_WIN64'
}


const LINK = getenv('LINK') || cc_compiler
const CC = getenv('CC') || c_compiler
const CXX = getenv('CXX') || cc_compiler
const CFLAGS = (getenv('CFLAGS') || `-fPIC -std=c++20 -c -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=64 -DV8_INTL_SUPPORT=1 -DV8_ALLOCATION_FOLDING -DV8_SHORT_BUILTIN_CALLS`).split(' ')
const LARGS = (getenv('LARGS') || link_args).split(' ')
const so_ext = (os === 'linux' ? 'so' : (os === 'mac' ? 'so' : 'dll'))
config.os = os
config.arch = arch
let LO_PATH = '../../lo' // TODO

if (os === 'mac') {
  const { mach } = lo.load('mach')
  const max_path = new Uint32Array([1024])
  const path_name = lo.ptr(new Uint8Array(1024))
  assert(mach.get_executable_path(path_name.ptr, max_path) === 0)
  LO_PATH = lo.latin1Decode(path_name.ptr, max_path[0])
} else if (os === 'linux') {
  const path_name = lo.ptr(new Uint8Array(1024))
  const len = core.readlink('/proc/self/exe', path_name, 1024)
  assert(len > 0)
  LO_PATH = lo.latin1Decode(path_name.ptr, len)
}

export {
  build, build_runtime, create_binding, compile_bindings, create_lo_home,
  install, upgrade, uninstall, init,
  config
}
