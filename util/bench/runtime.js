import { run, runAsync } from 'lib/bench.js'
const external = spin.load('spin').spin

const { 
  hrtime, getAddress, readMemory, utf8Length, wrapMemory, nextTick,
  registerCallback, runMicroTasks, builtin, library, builtins, libraries,
  setModuleCallbacks, loadModule, evaluateModule, utf8EncodeInto, utf8Decode
} = spin

const {
  callCallback, contextSize, createIsolateContext, destroyIsolateContext,
  startIsolate
} = external

const SIZE = 256

const u8 = new Uint8Array(SIZE)
u8.fill(255)
const dest = new Uint8Array(SIZE)
const ptr = getAddress(u8)
const str = 'hello'
readMemory(dest, ptr, SIZE)
const end = ptr + SIZE
const copy = wrapMemory(ptr, end)
const noop = () => {}

const exec = new Uint8Array(16)
const eptr = getAddress(exec)

const ctx = new Uint8Array(contextSize())
const argv = new Uint32Array(2)
const main = ''
const js = ''
const buf = new Uint8Array(0)
const fd = 1

createIsolateContext(0, argv, main, main.length, js, js.length,
  buf, buf.length, fd, 0, 'spin', 'foo.js', 1, 0, 0, ctx)

function createAndDestroyContext () {
  destroyIsolateContext(ctx)
  createIsolateContext(0, argv, main, main.length, js, js.length,
    buf, 0, fd, 0, 'spin', 'foo.js', 1, 0, 0, ctx)
}

createAndDestroyContext()

registerCallback(eptr, noop)

//run('startIsolate', () => startIsolate(ctx), 1000, 10)
//run('readMemory', () => readMemory(dest, ptr, SIZE), 200000000, 10)
//run('getAddress', () => getAddress(u8), 200000000, 10)
//run('now', hrtime, 40000000, 10)
//run('errno', () => spin.errno, 8000000, 10)
//run('utf8Length', () => utf8Length(str), 240000000, 10)
//run('wrapMemory', () => wrapMemory(ptr, end), 4000000, 10)
//run('nextTick', () => nextTick(noop), 1000000, 20, spin.runMicroTasks)
//run('registerCallback', () => registerCallback(eptr, noop), 30000000, 20)
//run('callCallback', () => callCallback(eptr), 30000000, 20)
//run('createAndDestroyContext', createAndDestroyContext, 300000, 20)
//run('runMicroTasks', () => runMicroTasks(), 30000000, 20)
//run('builtin', () => builtin('main.js'), 900000, 20)
//run('library', () => library('fs'), 90000, 20)
//run('builtins', () => builtins(), 1800000, 20)
//run('libraries', () => libraries(), 1800000, 20)
//run('setModuleCallbacks', () => setModuleCallbacks(noop, noop), 40000000, 20)
//run('loadModule', () => loadModule('', 'foo.js'), 200000, 20)
// evaluateModule
run('hrtime', () => hrtime(), 60000000, 20)
//run('utf8EncodeInto', () => utf8EncodeInto('hello', u8), 300000000, 20)
//utf8EncodeInto('hello', u8)
//run('utf8Decode', () => utf8Decode(ptr, 5), 60000000, 20)
// todo: evaluateModule (promise)

//const mod = loadModule('1', 'foo.js')
//const res = await evaluateModule(mod.identity)
//await runAsync('evaluateModule', () => evaluateModule(mod.identity), 12000000, 20)
