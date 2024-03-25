import { isFile, isDir } from 'lib/fs.js'
import { inflate } from 'lib/inflate.js'
import { fetch } from 'lib/curl.js'
import { untar } from 'lib/untar.js'
import { 
  bindings, linkerScript, headerFile, config, linkArgs, libPaths
} from 'lib/gen.js'
import { exec } from 'lib/proc.js'
import { baseName, extName, join } from 'lib/path.js'

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
//      writeFile(file_path, encoder.encode(lo.builtin(name)))
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
async function compile_bindings (lib, verbose = false, opt = OPT) {
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

  const src = bindings(def)

  let { obj = [], libs = [], lib_paths = [], include_paths = [] } = def

  if (def[os] && def[os]?.obj?.length) {
    obj = obj.concat(def[os].obj)
  }
  if (def[os] && def[os]?.libs?.length) {
    libs = libs.concat(def[os].libs)
  }
  if (def[os] && def[os]?.lib_paths?.length) {
    lib_paths = libs.concat(def[os].lib_paths)
  }
  if (def[os] && def[os]?.include_paths?.length) {
    include_paths = libs.concat(def[os].include_paths)
  }
  console.log(`${AY}create ${AD} ${lib_dir}/${def.name}.cc`)
  writeFile(`${lib_dir}/${def.name}.cc`, encoder.encode(src))

  const binding_build_path = `${lib_dir}/build.js`
  if (isFile(binding_build_path)) {
    console.log(`${AM}building dependencies${AD} ${lib} ${AY}in${AD} ${lib_dir}`)
    const { build } = await import (binding_build_path)
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
  console.log(`${AY}change dir to ${AD} ${cwd}`)
  assert(chdir(cwd) === 0)

  if (!obj || !obj.length) return []
  // todo: this is kind of a hack - if it is an absolute path, don't prefix it with binding path
  return obj.filter(f => extName(f) === 'a').map(f => f.slice(0, 1) === '/' ? f : `${lib_dir}/${f}`)
}

function create_builtins (libs = [], main = 'main.js', os) {
//  config.os = 'win'
//  writeFile(`${LO_HOME}/builtins.h`, encoder.encode([`main.js`, ...libs].map(linkerScript).join('')))
  const cwd = getcwd()
  function verify_path (path) {
    if (cwd !== LO_HOME && isFile(join(cwd, path))) {
      return linkerScript(path, cwd)
    }
    return linkerScript(path)
  }

  config.os = 'linux'
  writeFile(`${LO_HOME}/builtins_linux.S`, 
    encoder.encode(Array.from(new Set([main, ...libs])).map(verify_path).join('')))
  config.os = 'mac'
  writeFile(`${LO_HOME}/builtins.S`, 
    encoder.encode(Array.from(new Set([main, ...libs])).map(verify_path).join('')))
  config.os = os
}

function create_header (libs = [], bindings = [], index = '', main = 'main.js', opts) {
//  const os = config.os
//  config.os = 'win'
//  writeFile(`${LO_HOME}/main_win.h`, encoder.encode(headerFile([...libs, 
//    ...bindings.map(n => `lib/${n}/${n}.a`)], index, main, opts)))
//  config.os = 'mac'
  // todo: this is a hack to get mach in core runtime on macos for now
//  writeFile(`${LO_HOME}/main_mac.h`, encoder.encode(headerFile([...libs, 
//    ...bindings.map(n => `lib/${n}/${n}.a`)], index, main, opts)))
//    ...[...bindings.includes('mach') ? [] : ['mach'], ...bindings].map(n => `lib/${n}/${n}.a`)], index, main, opts)))
//  config.os = 'linux'
  writeFile(`${LO_HOME}/main.h`, encoder.encode(headerFile([...libs, 
    ...bindings.map(n => `lib/${n}/${n}.a`)], index, main, opts)))
//  config.os = os
}

async function build_runtime ({ libs = lo.builtins(), bindings = lo.libraries(), 
  embeds = [], target, link_type = LINK_TYPE, opt = OPT, 
  v8_opts = {}, index = '', main = 'main.js' }, verbose = false) {
  const cwd = getcwd()
  if (index) embeds.push(index)
  if (TARGET) target = TARGET
  Object.assign(defaultOpts, v8_opts)
  console.log(`${AY}create${AD} builtins`)
  create_builtins([...libs, ...embeds], main, config.os)
  console.log(`${AY}create${AD} main header`)
  create_header([...libs, ...embeds], bindings, index, main, defaultOpts)

  assert(chdir(LO_HOME) === 0)
  console.log(`${AY}compile${AD} builtins`)
  if (os === 'linux') {
    exec2([...CC.split(' '), '-c', 'builtins_linux.S', '-o', 'builtins.o'], verbose)
  } else if (os !== 'win') {
    exec2([...CC.split(' '), '-c', 'builtins.S', '-o', 'builtins.o'], verbose)
  }

  console.log(`${AY}compile${AD} main.cc`)
  exec2([...CXX.split(' '), `-DRUNTIME=${RUNTIME}`, `-DVERSION=${VERSION}`, 
    ...CFLAGS, ...opt.split(' '), `-I${LO_HOME}`, `-I${LO_HOME}/v8`, 
    '-I.', `-I${LO_HOME}/v8/include`, ...WARN, '-o', 'main.o', 'main.cc'], 
    verbose)

  console.log(`${AY}compile${AD} lo.cc`)
  exec2([...CXX.split(' '), `-DRUNTIME=${RUNTIME}`, `-DVERSION=${VERSION}`, 
    ...CFLAGS, ...opt.split(' '), `-I${LO_HOME}`, `-I${LO_HOME}/v8`, 
    '-I.', `-I${LO_HOME}/v8/include`, ...WARN, '-o', `${target}.o`, `lo.cc`], 
    verbose)

  console.log(`${AY}link runtime ${AD}`)

  let static_libs = bindings.map(n => `lib/${n}/${n}.a`)
  for (const binding of bindings) {
    static_libs = static_libs.concat(await compile_bindings(binding, verbose, opt))
  }
  let dynamic_libs = await linkArgs(bindings.map(n => `lib/${n}/api.js`))
  if (link_type.split(' ').includes('-static')) {
    dynamic_libs = dynamic_libs.filter(lib => lib !== '-ldl')
  }
  // todo: this is all just a first pass and quite inefficient, although modules should be cached
  let lib_paths = await libPaths(bindings.map(n => `lib/${n}/api.js`))
  let bin = target
  if (cwd !== LO_HOME) bin = `${join(cwd, target)}`
  exec2([...LINK.split(' '), ...LARGS, ...opt.split(' '), ...link_type.split(' '), ...WARN, '-o', 
    `${bin}`, `${target}.o`, 'main.o', 'builtins.o', 'v8/libv8_monolith.a', 
    ...static_libs, ...dynamic_libs, ...lib_paths], verbose) 
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

const encoder = new TextEncoder()
const status = new Int32Array(2)

// todo: clean up api so we can pass a config in and run builds through api
const VERSION = getenv('VERSION') || `"${lo.version.lo.split('.').slice(0, 3).join('.')}"`
const RUNTIME = getenv('RUNTIME') || '"lo"'
const TARGET = getenv('TARGET')
const LINK_TYPE = getenv('LINK_TYPE') || '-rdynamic'
const OPT = getenv('OPT') || '-O3'
const WARN = (getenv('WARN') || 
  '-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter').split(' ')
const LO_HOME = getenv('LO_HOME') || getcwd()
const v8 = getenv('V8_VERSION') || lo.version.v8.split('.').slice(0, 2).join('.')
//const v8 = getenv('V8_VERSION') || '12.3'
const os = getenv('LO_OS') || core.os
const arch = getenv('LO_ARCH') || core.arch
//const cwd = getenv('LO_WORKDIR') || getcwd()
const url_prefix = getenv('LO_URL_PREFIX') || 'https://github.com/just-js'
const v8_path = getenv('LO_V8_PATH') || 'v8/releases/download'
const v8_url_prefix = `${url_prefix}/${v8_path}`
// todo: way to override these - usse env?
// todo: only set this if memory is > 16 GB on x86_64 
// --huge-max-old-generation-size
let defaultOpts = {
  v8_cleanup: 0, v8_threads: 2, on_exit: 0,
  v8flags: '--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init --cppgc-young-generation'
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
}

const LINK = getenv('LINK') || cc_compiler
const CC = getenv('CC') || c_compiler
const CXX = getenv('CXX') || cc_compiler
const CFLAGS = (getenv('CFLAGS') || `-fPIC -std=c++17 -c -DV8_COMPRESS_POINTERS -DV8_TYPED_ARRAY_MAX_SIZE_IN_HEAP=0 -DV8_INTL_SUPPORT=1`).split(' ')
const LARGS = (getenv('LARGS') || link_args).split(' ')
const so_ext = (os === 'linux' ? 'so' : (os === 'mac' ? 'so' : 'dll'))
config.os = os
config.arch = arch

let LO_PATH = '../../lo'
if (os === 'mac') {
  const { mach } = lo.load('mach')
  const max_path = new Uint32Array([1024])
  const path_name = lo.ptr(new Uint8Array(1024))
  assert(mach.get_executable_path(path_name.ptr, max_path) === 0)
  LO_PATH = lo.latin1Decode(path_name.ptr, max_path[0])
  console.log(LO_PATH)
} else if (os === 'linux') {
  const path_name = lo.ptr(new Uint8Array(1024))
  const len = core.readlink('/proc/self/exe', path_name, 1024)
  assert(len > 0)
  LO_PATH = lo.latin1Decode(path_name.ptr, len)
}

async function build (args) {
  let verbose = false
  if (args.includes('-v')) {
    args = args.filter(a => a !== '-v')
    verbose = true
  }
  await create_lo_home(LO_HOME)
  const [ action = 'runtime', name = 'builder' ] = args
  if (action === 'runtime') {
    const runtime_config = await import(name)
    await build_runtime(runtime_config.default, verbose)
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

export { 
  build, build_runtime, create_binding, compile_bindings, config 
}
