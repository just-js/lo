import { isFile, isDir } from 'lib/fs.js'
import { inflate } from 'lib/zlib.js'
import { fetch } from 'lib/curl.js'
import { untar } from 'lib/untar.js'
import { bindings, linkerScript, headerFile, config } from 'lib/gen.js'
import { exec } from 'lib/proc.js'
import { baseName } from 'lib/path.js'

// todo: if LO_HOME env var is not present then create it in .lo in current dir
// todo: if LO_HOME or .lo do not exist, create them
// todo: async fetch and process spawn so we can parallelize tasks
// todo: we need include_paths in the bindings
//       exec('ccache', [CC, ...CFLAGS, OPT, `-I${LO_HOME}`, `-I${LO_HOME}/v8`, `-I${LO_HOME}/v8/include`, ...def.includes.map(i => `-I${i}`), ...WARN, '-o', `${def.name}.o`, `${def.name}.cc`], status)

/*
if we don't modify LO_HOME other than when installing or upgrading then
we can have multiple builds for different projects happening at in parallel and
all outputting artifacts into their own directories

so here i can load a library from builtins() or from local directory or from LO_HOME or from just-js/lo github

todo: do ccache checking in JS


LO_TARGET and LO_HOME

todo: make fetch and exec async and parallelize them


*/

const { core, getenv, getcwd, assert, colors } = lo
const { AM, AY, AG, AD } = colors
const {
  writeFile, chdir, mkdir, readFile, unlink,
  S_IXOTH, S_IRWXU, S_IRWXG, S_IROTH
} = core

function exec2 (args, verbose = false) {
  if (verbose) console.log(args.join(' '))
  exec(args[0], args.slice(1), status)
  assert(status[0] === 0)
}

async function create_lo_home (path) {
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
      fetch(`${v8_url_prefix}/${v8}/libv8_monolith-${os}-${arch}.a.tar.gz`, 
      file_name)
    console.log(`${AY}downloaded${AD} ${file_name} ${AG}size${AY} ${size}`)
    bytes = readFile(file_name)
    writeFile('v8/libv8_monolith.a', inflate(bytes))
    unlink(file_name)
  }

  chdir(cwd)
} 

async function compile_bindings (lib, verbose = false) {
  const lib_dir = `lib/${lib}`
  const binding_path = `${lib_dir}/api.js`
  const def = await import(binding_path)
  const src = bindings(def)

  console.log(`${AM}compile binding${AD} ${lib} ${AY}in${AD} ${lib_dir}`)
  if (!isDir(lib_dir) && lo.builtins().includes(binding_path)) {
    console.log(`${AM}create dir${AD} ${lib_dir}`)
    assert(mkdir(`${lib_dir}`, S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH) === 0)
    console.log(`${AM}create bindings def at ${AD} ${lib_dir}/api.js`)
    writeFile(`${lib_dir}/api.js`, encoder.encode(lo.builtin(binding_path)))
  }

  console.log(`${AY}create ${AD} ${lib_dir}/${def.name}.cc`)
  writeFile(`${lib_dir}/${def.name}.cc`, encoder.encode(src))

  console.log(`${AY}change dir to ${AD} ${lib_dir}`)
  assert(chdir(lib_dir) === 0)

  console.log(`${AY}compile${AD} ${def.name}.cc ${AY}with${AG} ${CC}${AD}`)
  exec2([...CC.split(' '), ...CFLAGS, OPT, `-I${LO_HOME}`, `-I${LO_HOME}/v8`, 
    `-I${LO_HOME}/v8/include`, ...WARN, '-o', `${def.name}.o`, 
    `${def.name}.cc`], verbose)

  console.log(`${AY}compile static lib ${AD} ${def.name}.a`)
  if (def.obj && def.obj.length) {
    exec2(['ar', 'crsT', `${def.name}.a`, `${def.name}.o`, ...def.obj])
  } else {
    exec2(['ar', 'crsT', `${def.name}.a`, `${def.name}.o`])
  }

  console.log(`${AY}link shared lib ${AD} ${def.name}.so ${AY}with${AG} ${CC}${AD}`)
  exec2([...LINK.split(' '), ...LARGS, OPT, '-shared', ...WARN, '-o', 
    `${def.name}.so`, `${def.name}.o`, ...(def.libs || []).map(l => `-l${l}`)],
    verbose)

  console.log(`${AY}change dir to ${AD} ${cwd}`)
  assert(chdir(cwd) === 0)
}

function create_builtins (libs = []) {
  const asm = [...lo.builtins(), ...libs].map(linkerScript).join('')
  if (os === 'win') {
    writeFile(`${LO_HOME}/builtins.h`, encoder.encode(asm))
  } else {
    writeFile(`${LO_HOME}/builtins.S`, encoder.encode(asm))
  }
}

function create_header (libs = [], bindings = []) {
  const main_h = headerFile([...libs, ...lo.builtins(), 
    ...lo.libraries().map(n => `lib/${n}/${n}.a`), ...bindings])
  writeFile(`${LO_HOME}/main.h`, encoder.encode(main_h))
}

const encoder = new TextEncoder()
const status = new Int32Array(2)

// use ```lo LINK="mold -run g++" CC="ccache g++" build.js```  for fast builds
const C = getenv('C') || 'gcc'
const CC = getenv('CC') || 'g++'
const LINK = getenv('LINK') || 'g++'
const OPT = getenv('OPT') || '-O3'
const CFLAGS = (getenv('CFLAGS') || '-fPIC -std=c++17 -c').split(' ')
const WARN = (getenv('WARN') || 
  '-Werror -Wpedantic -Wall -Wextra -Wno-unused-parameter').split(' ')
const LARGS = (getenv('LARGS') || '-s').split(' ')
const LO_HOME = getenv('LO_HOME') || '.lo'
const v8 = getenv('V8_VERSION') || '12.0'
const os = getenv('LO_OS') || lo.os()
const arch = getenv('LO_ARCH') || lo.arch()
const cwd = getenv('LO_WORKDIR') || getcwd()
const url_prefix = getenv('LO_URL_PREFIX') || 'https://github.com/just-js'
const v8_path = getenv('LO_V8_PATH') || 'v8/releases/download'
const v8_url_prefix = `${url_prefix}/${v8_path}`

config.os = os
const all = ['curl', 'zlib', 'libssl', 'sqlite', 'core', 'pthread']

let verbose = false
let args = lo.args
if (args.includes('-v')) {
  args = args.filter(a => a !== '-v')
  verbose = true
}
await create_lo_home(LO_HOME)
create_builtins()
create_header()
const libs = args.length > 2 ? args.slice(2) : all
for (const lib of libs) await compile_bindings(lib, verbose)
