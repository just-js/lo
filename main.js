const AD = '\u001b[0m' // ANSI Default
const A0 = '\u001b[30m' // ANSI Black
const AR = '\u001b[31m' // ANSI Red
const AG = '\u001b[32m' // ANSI Green
const AY = '\u001b[33m' // ANSI Yellow
const AB = '\u001b[34m' // ANSI Blue
const AM = '\u001b[35m' // ANSI Magenta
const AC = '\u001b[36m' // ANSI Cyan
const AW = '\u001b[37m' // ANSI White

function assert (condition, message, ErrorType = Error) {
  if (!condition) {
    if (message && message.constructor.name === 'Function') {
      throw new ErrorType(message())
    }
    throw new ErrorType(message || "Assertion failed")
  }
  return condition
}

function wrap (h, fn, plen = 0) {
  const call = fn
  const params = (new Array(plen)).fill(0).map((_, i) => `p${i}`).join(', ')
  const f = new Function(
    'h',
    'call',
    `return function ${fn.name} (${params}) {
    call(${params}${plen > 0 ? ', ' : ''}h);
    return h[0] + ((2 ** 32) * h[1]);
  }`,)
  const fun = f(h, call)
  if (fn.state) fun.state = fn.state
  return fun
}

const { start, print, args } = lo

const console = {
  log: str => print(`${str}\n`)
}

function rejectedPromiseHandler (err) {
  print(`${AR}Unhandled Rejection${AD}\n`)
  print(`${err.stack}\n`)
  lo.exit(1)
}

globalThis.onUnhandledRejection = rejectedPromiseHandler
const hrtime = wrap(new Uint32Array(2), lo.hrtime)
const os = lo.os()
const arch = lo.arch()

function test () {
  if (os === 'win') {
    assert(args[0] === './lo.exe' || args[0] === 'lo.exe' || args[0] === 'lo' || args[0] === './lo')
  } else {
    assert(args[0] === './lo' || args[0] === 'lo')
    assert(start > 0)
    assert(hrtime() > start)
  }
  assert(lo.hasOwnProperty('version'))
  assert(lo.version.constructor.name === 'Object')
  assert(lo.version.hasOwnProperty('lo'))
  assert(lo.version.hasOwnProperty('v8'))
  assert(lo.version.lo.constructor.name === 'String')
  assert(lo.version.v8.constructor.name === 'String')
  assert(lo.hasOwnProperty('errno'))
  lo.errno = 0
  assert(lo.errno === 0)
  const names = [
    'nextTick', 'print', 'registerCallback', 'runMicroTasks', 'builtin', 'library',
    'builtins', 'libraries', 'setModuleCallbacks', 'loadModule', 'evaluateModule',
    'utf8Decode', 'utf8Encode', 'wrapMemory', 'unwrapMemory', 'setFlags', 'getMeta',
    'runScript', 'arch', 'os', 'hrtime', 'getAddress', 'utf8Length', 'utf8EncodeInto',
    'utf8EncodeIntoAtOffset', 'readMemory', 'readMemoryAtOffset'
  ]
  for (const name of names) {
    //console.log(`checking ${AM}${name}${AD}`)
    assert(lo.hasOwnProperty(name))
    assert(lo[name].constructor.name === 'Function')
  }
  console.log(`${AM}tests${AD}   ok`)
}

function main () {
  const elapsed = hrtime() - start
  console.log(`------------------------
        ${AY}lo.js${AD}
------------------------`)
  console.log(`${AG}args${AD}    ${args}`)  
  if (args.length > 1 && args[1] === '--test') test()
  console.log(`${AG}os${AD}      ${os}  
${AG}arch${AD}    ${arch}  
${AG}boot${AD}    ${(elapsed / 1000000).toFixed(2)} ms  
${AG}version${AD} ${lo.version.lo}  
${AG}v8${AD}      ${lo.version.v8}`)
}

main()
