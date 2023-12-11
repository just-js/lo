import { isFile, isDir, mkDirAll } from 'lib/fs.js'
import { inflate } from 'lib/inflate.js'
import { fetch } from 'lib/curl.js'
import { untar } from 'lib/untar.js'
import { bindings, linkerScript, headerFile, config, linkArgs } from 'lib/gen.js'
import { exec } from 'lib/proc.js'
import { baseName, extName, join } from 'lib/path.js'

// todo: ability to generate a config file from scratch or from a js script
// todo: ability to build from a config file
// todo: ability o chain build commands together
// todo: async fetch and process spawn so we can parallelize tasks
// todo: check timestamps on dependencies and only compile if changed
// todo: clean command
// todo: store the build configuration in the binary
const { core, getenv, getcwd, assert, colors } = lo
const { AM, AY, AG, AD, AR } = colors
const {
  writeFile, chdir, mkdir, readFile, unlink, S_IXOTH, S_IRWXU, S_IRWXG, S_IROTH
} = core

function exec2 (args, verbose = false) {
  if (verbose) console.log(args.join(' '))
  exec(args[0], args.slice(1), status)
  assert(status[0] === 0)
}

async function create_lo_home (path) {
  const cwd = getcwd()
  if (!isDir(path)) {
    console.log(`${AM}create LO_HOME in ${AD} ${path}`)
    assert(mkdir(path, S_IRWXU | S_IRWXG | S_IROTH) === 0)
  }

  for (const name of lo.builtins()) {
    const file_path = `${path}/${name}`
    if (!isDir(baseName(file_path))) {
      console.log(`${AY}create dir for HOME${AD} ${baseName(file_path)}`)
      assert(mkdir(baseName(file_path), S_IRWXU | S_IRWXG | S_IROTH) === 0)
    }
    if (!isFile(file_path)) {
      console.log(`${AY}create builtin ${AD} ${file_path}`)
      writeFile(file_path, encoder.encode(lo.builtin(name)))
    }
  }

  chdir(path)

  let file_name, size, bytes

  if (!isDir('v8/include')) {
    file_name = 'include.tar.gz'
    console.log(`${AY}download v8 includes for version ${AD}${v8}`)
    size = 
      fetch(`${v8_url_prefix}/${v8}/include.tar.gz`, 
      file_name)
    console.log(`${AY}downloaded${AD} ${file_name} ${AG}size${AY} ${size}`)
    bytes = readFile(file_name)
    untar(inflate(bytes))
    unlink(file_name)
  }

  if (!isFile('v8/libv8_monolith.a')) {
    file_name = `libv8_monolith-${os}-${arch}.a.gz`
    console.log(`${AY}download v8 static lib for version ${AD}${v8}`)
    size = 
      fetch(`${v8_url_prefix}/${v8}/libv8_monolith-${os}-${arch}.a.gz`, 
      file_name)
    console.log(`${AY}downloaded${AD} ${file_name} ${AG}size${AY} ${size}`)
    bytes = readFile(file_name)
    writeFile('v8/libv8_monolith.a', inflate(bytes))
    unlink(file_name)
  }

  chdir(cwd)
} 

// todo: change these methods to accept objects, not filenames
async function compile_bindings (lib, verbose = false) {
  const cwd = getcwd()
  const lib_dir = join(LO_HOME, `lib/${lib}`)
  const binding_path = join(LO_HOME, `${lib_dir}/api.js`)

  // todo: download the lib if we don't have it internally
  console.log(`${AM}compile binding${AD} ${lib} ${AY}in${AD} ${lib_dir}`)
  if (!isDir(lib_dir) && lo.builtins().includes(binding_path)) {
    console.log(`${AM}create dir${AD} ${lib_dir}`)
    assert(mkdir(`${lib_dir}`, S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH) === 0)
    console.log(`${AM}create bindings def at ${AD} ${lib_dir}/api.js`)
    writeFile(`${lib_dir}/api.js`, encoder.encode(lo.builtin(binding_path)))
  }

  const def = await import(binding_path)
  const { include_paths = [] } = def
  const src = bindings(def)

  console.log(`${AY}create ${AD} ${lib_dir}/${def.name}.cc`)
  writeFile(`${lib_dir}/${def.name}.cc`, encoder.encode(src))

  const binding_build_path = `${lib_dir}/build.js`
  if (isFile(binding_build_path)) {
    console.log(`${AM}building dependencies${AD} ${lib} ${AY}in${AD} ${lib_dir}`)
    const { build } = await import (binding_build_path)
    console.log(`${AY}change dir to ${AD} ${lib_dir}`)
    assert(chdir(lib_dir) === 0)
    await build(C, CC)
  } else {
    console.log(`${AY}change dir to ${AD} ${lib_dir}`)
    assert(chdir(lib_dir) === 0)
  }

  console.log(`${AY}compile${AD} ${def.name}.cc ${AY}with${AG} ${CC}${AD}`)
  unlink(`${def.name}.o`)
  exec2([...CC.split(' '), ...CFLAGS, OPT, `-I${LO_HOME}`, `-I${LO_HOME}/v8`, 
    ...include_paths.map(p => `-I${p}`), '-I.', `-I${LO_HOME}/v8/include`,
    `-I${lib_dir}`, ...WARN, '-o', `${def.name}.o`, `${def.name}.cc`], verbose)

  console.log(`${AY}static lib ${AD} ${def.name}.a`)
  unlink(`${def.name}.a`)
  if (def.obj && def.obj.length) {
    exec2(['ar', 'crsT', `${def.name}.a`, `${def.name}.o`, 
      ...def.obj.filter(f => extName(f) === 'o')], verbose)
  } else {
    exec2(['ar', 'crsT', `${def.name}.a`, `${def.name}.o`], verbose)
  }

// todo: fix this for mac
// https://copyprogramming.com/howto/what-are-the-differences-between-so-and-dylib-on-macos
  console.log(`${AY}shared lib ${AD} ${def.name}.so ${AY}with${AG} ${CC}${AD}`)
  unlink(`${def.name}.so`)
  if (os === 'mac') {
    exec2([...LINK.split(' '), '-bundle_loader', LO_PATH, ...LARGS, OPT, '-bundle', ...WARN, '-o', 
      `${def.name}.so`, `${def.name}.o`, 
      ...(def.obj || []).filter(f => extName(f) === 'a'), 
      ...(def.libs || []).map(l => `-l${l}`), 
      ...(def.lib_paths || []).map(l => `-L${l}`)],
      verbose)
  } else if (os === 'linux') {
    // todo: why do we not include .o obj files here?
    // confused by this. why does linking against the .a file not work?
    exec2([...LINK.split(' '), ...LARGS, OPT, '-shared', ...WARN, '-o', 
      `${def.name}.so`, `${def.name}.o`, 
      ...(def.obj || []).filter(f => extName(f) === 'o'), 
      ...(def.libs || []).map(l => `-l${l}`), 
      ...(def.lib_paths || []).map(l => `-L${l}`)],
      verbose)
  }
  console.log(`${AY}change dir to ${AD} ${cwd}`)
  assert(chdir(cwd) === 0)

  if (!def.obj) return []
  // todo: this is kind of a hack - if it is an absolute path, don't prefix it with binding path
  return def.obj.filter(f => extName(f) === 'a').map(f => f.slice(0, 1) === '/' ? f : `${lib_dir}/${f}`)
}

function create_builtins (libs = [], os) {
//  config.os = 'win'
//  writeFile(`${LO_HOME}/builtins.h`, encoder.encode([`main.js`, ...libs].map(linkerScript).join('')))
  config.os = 'linux'
  writeFile(`${LO_HOME}/builtins_linux.S`, 
    encoder.encode([`main.js`, ...libs].map(linkerScript).join('')))
  config.os = 'mac'
  writeFile(`${LO_HOME}/builtins.S`, 
    encoder.encode([`main.js`, ...libs].map(linkerScript).join('')))
  config.os = os
}

function create_header (libs = [], bindings = [], opts) {
  const os = config.os
  config.os = 'win'
  writeFile(`${LO_HOME}/main_win.h`, encoder.encode(headerFile([...libs, 
    ...bindings.map(n => `lib/${n}/${n}.a`)], opts)))
  config.os = 'mac'
  // todo: this is a hack to get mach in core runtime on macos for now
  writeFile(`${LO_HOME}/main_mac.h`, encoder.encode(headerFile([...libs, 
    ...[...bindings.includes('mach') ? [] : ['mach'], ...bindings].map(n => `lib/${n}/${n}.a`)], opts)))
  config.os = 'linux'
  writeFile(`${LO_HOME}/main.h`, encoder.encode(headerFile([...libs, 
    ...bindings.map(n => `lib/${n}/${n}.a`)], opts)))
  config.os = os
}

async function build_runtime ({ libs = lo.builtins(), bindings = lo.libraries(), 
  embeds = [] }, verbose = false) {
  const cwd = getcwd()
  console.log(`${AY}create${AD} builtins`)
  create_builtins([...libs, ...embeds], config.os)
  console.log(`${AY}create${AD} main header`)
  create_header([...libs, ...embeds], bindings, defaultOpts)

  assert(chdir(LO_HOME) === 0)
  console.log(`${AY}compile${AD} builtins`)
  if (os === 'linux') {
    exec2([...C.split(' '), '-c', 'builtins_linux.S', '-o', 'builtins.o'], verbose)
  } else if (os !== 'win') {
    exec2([...C.split(' '), '-c', 'builtins.S', '-o', 'builtins.o'], verbose)
  }

  console.log(`${AY}compile${AD} main.cc`)
  exec2([...CC.split(' '), `-DRUNTIME=${RUNTIME}`, `-DVERSION=${VERSION}`, 
    ...CFLAGS, OPT, `-I${LO_HOME}`, `-I${LO_HOME}/v8`, 
    '-I.', `-I${LO_HOME}/v8/include`, ...WARN, '-o', 'main.o', 'main.cc'], 
    verbose)

  console.log(`${AY}compile${AD} lo.cc`)
  exec2([...CC.split(' '), `-DRUNTIME=${RUNTIME}`, `-DVERSION=${VERSION}`, 
    ...CFLAGS, OPT, `-I${LO_HOME}`, `-I${LO_HOME}/v8`, 
    '-I.', `-I${LO_HOME}/v8/include`, ...WARN, '-o', `${TARGET}.o`, `lo.cc`], 
    verbose)

  console.log(`${AY}link runtime ${AD}`)

  let static_libs = bindings.map(n => `lib/${n}/${n}.a`)
  for (const binding of bindings) {
    static_libs = static_libs.concat(await compile_bindings(binding, verbose))
  }
  const dynamic_libs = await linkArgs(bindings.map(n => `lib/${n}/api.js`))
  exec2([...LINK.split(' '), ...LARGS, OPT, ...LINK_TYPE, ...WARN, '-o', 
    `${TARGET}`, `${TARGET}.o`, 'main.o', 'builtins.o', 'v8/libv8_monolith.a', 
    ...static_libs, ...dynamic_libs], verbose) 
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

export { name, api, constants, preamble }
`  
}

const encoder = new TextEncoder()
const status = new Int32Array(2)

// todo: clean up api so we can pass a config in and run builds through api
const VERSION = getenv('VERSION') || '"0.0.12pre"'
const RUNTIME = getenv('RUNTIME') || '"lo"'
const TARGET = getenv('TARGET') || 'lo'
const LINK_TYPE = (getenv('LINK_TYPE') || '-rdynamic').split(' ')
const OPT = getenv('OPT') || '-O3'
const WARN = (getenv('WARN') || 
  '-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter').split(' ')
const LO_HOME = getenv('LO_HOME') || getcwd()
const v8 = getenv('V8_VERSION') || '1.0.0'
const os = getenv('LO_OS') || lo.os()
const arch = getenv('LO_ARCH') || lo.arch()
//const cwd = getenv('LO_WORKDIR') || getcwd()
const url_prefix = getenv('LO_URL_PREFIX') || 'https://github.com/just-js'
const v8_path = getenv('LO_V8_PATH') || 'v8/releases/download'
const v8_url_prefix = `${url_prefix}/${v8_path}`
// todo: way to override these - usse env?
const defaultOpts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init'
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
let link_args = '-s'
if (os === 'mac') {
  if (arch === 'arm64') {
    link_args = '-s -arch arm64 -w'
  } else {
    link_args = '-s -w'
  }
}

const LINK = getenv('LINK') || cc_compiler
const C = getenv('C') || c_compiler
const CC = getenv('CC') || cc_compiler
const CFLAGS = (getenv('CFLAGS') || `-fPIC -std=c++17 -c -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0`).split(' ')
const LARGS = (getenv('LARGS') || link_args).split(' ')
const so_ext = (os === 'linux' ? 'so' : (os === 'mac' ? 'so' : 'dll'))
config.os = os

let LO_PATH = '../../lo'
if (os === 'mac') {
  const { mach } = lo.load('mach')
  const max_path = new Uint32Array([1024])
  const path_name = lo.ptr(new Uint8Array(1024))
  assert(mach.get_executable_path(path_name.ptr, max_path) === 0)
  LO_PATH = lo.latin1Decode(path_name.ptr, max_path[0])
  console.log(`found lo at ${LO_PATH}`)
}

const runtimes = {
  core: {
    bindings: [
      'core'
    ],
    libs: []
  },
  builder: {
    bindings: [
      'core', 
      'inflate', 
      'curl', 
    ],
    libs: [
      'lib/bench.js', 
      'lib/gen.js', 
      'lib/fs.js', 
      'lib/untar.js', 
      'lib/proc.js', 
      'lib/path.js', 
      'lib/curl.js',
      'lib/inflate.js', 
      'lib/build.js', 
      'lib/asm.js', 
      'lib/ffi.js', 
      'lib/binary.js'
    ],
    embeds: [
      'main.cc',
      'lo.cc', 
      'lo.h',
      'lib/core/api.js',
      'lib/curl/api.js',
      'lib/duckdb/api.js',
      'lib/duckdb/build.js',
      'lib/encode/api.js',
      'lib/epoll/api.js',
      'lib/inflate/api.js',
      'lib/inflate/build.js',
      'lib/libffi/api.js',
      'lib/libssl/api.js',
      'lib/lz4/api.js',
      'lib/mbedtls/api.js',
      'lib/mbedtls/build.js',
      'lib/net/api.js',
      'lib/pico/api.js',
      'lib/pico/build.js',
      'lib/pthread/api.js',
      'lib/seccomp/api.js',
      'lib/sqlite/api.js',
      'lib/system/api.js',
      'lib/tcc/api.js',
      'lib/tcc/build.js',
      'lib/wireguard/api.js',
      'lib/wireguard/build.js',
      'lib/zlib/api.js',
    ]
  },
  full: {
    // todo: change this so we define the platforms in the api.js and we just filter above
    bindings: (os === 'linux' ? [
      'core', 
      'curl',
      'duckdb',
      'encode', 
      'epoll', 
      'inflate',
      'libffi',
      'libssl',
      'lz4', 
      'net', 
      'pico', 
      'pthread', 
      'sqlite', 
      'system', 
      'zlib'
    ] : [
      'core', 
      'curl',
      'encode', 
      'inflate', 
      'libffi', 
      'libssl', 
      'net', 
      'pico', 
      'pthread', 
      'sqlite', 
      'system', 
      'zlib'      
    ]),
    libs: (os === 'linux' ? [
      'lib/bench.js', 
      'lib/gen.js', 
      'lib/fs.js', 
      'lib/untar.js', 
      'lib/proc.js', 
      'lib/path.js', 
      'lib/inflate.js', 
      'lib/curl.js', 
      'lib/build.js', 
      'lib/asm.js', 
      'lib/ffi.js', 
      'lib/binary.js', 
      'lib/tcc.js', 
      'lib/zlib.js',
      'lib/sqlite.js'
    ]: [
      'lib/bench.js', 
      'lib/gen.js', 
      'lib/fs.js', 
      'lib/untar.js', 
      'lib/proc.js', 
      'lib/path.js', 
      'lib/inflate.js', 
      'lib/curl.js', 
      'lib/build.js', 
      'lib/asm.js', 
      'lib/ffi.js', 
      'lib/binary.js', 
      'lib/zlib.js',
      'lib/sqlite.js'
    ]),
    embeds: (os === 'linux' ? [
      'main.cc',
      'lo.cc', 
      'lo.h',
      'lib/core/api.js',
      'lib/curl/api.js',
      'lib/encode/api.js',
      'lib/epoll/api.js',
      'lib/inflate/api.js',
      'lib/libffi/api.js',
      'lib/libssl/api.js',
      'lib/lz4/api.js',
      'lib/inflate/em_inflate.c',
      'lib/inflate/em_inflate.h',
      'lib/mbedtls/api.js',
      'lib/net/api.js',
      'lib/pico/api.js',
      'lib/pthread/api.js',
      'lib/seccomp/api.js',
      'lib/sqlite/api.js',
      'lib/system/api.js',
      'lib/tcc/api.js',
      'lib/wireguard/api.js',
      'lib/zlib/api.js',
      'lib/duckdb/api.js'
    ] : [
      'main.cc',
      'lo.cc', 
      'lo.h',
      'lib/core/api.js',
      'lib/curl/api.js',
      'lib/encode/api.js',
      'lib/inflate/api.js',
      'lib/libffi/api.js',
      'lib/libssl/api.js',
      'lib/inflate/em_inflate.c',
      'lib/inflate/em_inflate.h',
      'lib/mbedtls/api.js',
      'lib/net/api.js',
      'lib/pico/api.js',
      'lib/pthread/api.js',
      'lib/sqlite/api.js',
      'lib/system/api.js',
      'lib/zlib/api.js',
      'lib/duckdb/api.js'
    ])
  },
  mbedtls: {
    bindings: [
      'core', 
      'inflate', 
      'mbedtls'
    ],
    libs: [
      'lib/bench.js', 
      'lib/gen.js', 
      'lib/fs.js', 
      'lib/untar.js', 
      'lib/proc.js', 
      'lib/path.js', 
      'lib/inflate.js'
    ]
  }
}

if (os === 'mac') {
  Object.keys(runtimes).forEach(name => runtimes[name].bindings.push('mach'))
}

async function build (args) {
  let verbose = false
  if (args.includes('-v')) {
    args = args.filter(a => a !== '-v')
    verbose = true
  }
  // it's 11 ms versus 7ms for ```hyperfine "lo eval 1"``` for curl build versus mbedtls 
  // use ```lo LINK="mold -run g++" CC="ccache g++" build.js```  for fast builds
  await create_lo_home(LO_HOME)
  const [ action = 'runtime', name = 'builder' ] = args
  if (action === 'runtime') {
    if (runtimes[name]) {
      await build_runtime(runtimes[name], verbose)
    } else {
      const runtime_config = await import(name)
      //console.log(JSON.stringify(runtime_config.default, null, '  '))
      await build_runtime(runtime_config.default, verbose)
    }
  } else if (action === 'binding') {
    // todo: check if name is an existing binding and install that if it doesn't exist
    // or maybe this should be a different "add" command?
    const dir_path = `lib/${name}`
    if (!isDir('./lib')) {
      assert(mkdir('./lib', S_IRWXU | S_IRWXG | S_IROTH) === 0)
    }
    if (!isDir(dir_path)) {
      assert(mkdir(dir_path, S_IRWXU | S_IRWXG | S_IROTH) === 0)
    }
    const file_path = `${dir_path}/api.js`
    if (!isFile(file_path)) {
      writeFile(file_path, encoder.encode(create_binding(name)))
    }
    const so_path = `${dir_path}/${name}.${so_ext}`
    if (!isFile(so_path)) {
      if (isFile(`${join(LO_HOME, so_path)}`)) {
        writeFile(so_path, readFile(join(LO_HOME, so_path)))
      } else {
        writeFile(so_path, encoder.encode(create_binding(name)))
      }
    }
    await compile_bindings(name, verbose)
  } else {
    throw new Error('build command not understood')
  }
}

export { build }
