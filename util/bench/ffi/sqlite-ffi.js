import { Assembler } from './lib/asm.js'
import { bind } from 'lib/fast.js'
import { run } from 'lib/bench.js'

import * as sqlite from 'bindings/sqlite/sqlite.js'

const { 
  dlopen, dlsym, ptr, registerCallback, assert, readMemory, utf8Decode, wrap, 
  addr 
} = spin

const pHandle = new Uint32Array(2)
const path = 'libsqlite3.so'
const handle = dlopen(path, 1)
const dbName = ':memory:'

const binding = {}
Object.keys(sqlite.api).forEach(k => {
  const def = sqlite.api[k]
  const sym = dlsym(handle, def.name || k)
  assert(sym)
  const fn = bind(sym, def.result, def.parameters, def.nofast)
  if (def.result === 'pointer') {
    binding[k] = wrap(pHandle, fn, def.parameters.length)
  } else {
    binding[k] = fn
  }
})

const {
  open2, exec3, exec, exec2, exec4
} = binding

function open (path = ':memory:', flags = OPEN_CREATE | OPEN_READWRITE | OPEN_NOMUTEX) {
  const rc = open2(path, pHandle, flags, 0)
  assert(rc === 0)
  return addr(pHandle)
}

function address_as_bytes (address) {
  return Array.from(new Uint8Array((new BigUint64Array([
    BigInt(address)
  ])).buffer))
}

const OPEN_CREATE = 0x00000004
const OPEN_READWRITE = 0x00000002
const OPEN_NOMUTEX = 0x00008000

const strnlen = bind(dlsym(0, 'strnlen'), 'i32', ['pointer', 'u32'])
assert(strnlen.state.ptr)

const u32 = new Uint32Array(2)
const db = open(dbName)

const maxCol = 128

const fptrs = new Uint8Array(maxCol * 8)
const nptrs = new Uint8Array(maxCol * 8)

const maxFieldSize = 1024

const fu32s = []
const nu32s = []
for (let i = 0; i < maxCol; i++) {
  fu32s.push(new Uint32Array(fptrs.buffer, i * 8, 2))
  nu32s.push(new Uint32Array(nptrs.buffer, i * 8, 2))
}

function callback2 () {
  //assert(addr(ctxu32) === 0)
  assert(cu32[0] === 1)
}

function callback () {
  try {
    const cols = cu32[0]
    const size = cols * 8
    readMemory(fptrs, addr(fu32), size)
    readMemory(nptrs, addr(nu32), size)
    const row = {}
    for (let i = 0; i < cols; i++) {
      const nptr = addr(nu32s[i])
      if (!nptr) continue
      const fptr = addr(fu32s[i])
      if (fptr) {
        row[utf8Decode(nptr, strnlen(nptr, maxFieldSize))] = 
          utf8Decode(fptr, strnlen(fptr, maxFieldSize))
        continue
      }
    }
    //console.log(JSON.stringify(row))
    dv.setUint32(16, 0, true)
  } catch (err) {
    console.log(err.stack)
    dv.setUint32(16, 1, true)
  }
}

const asm = new Assembler()

const callback_address = dlsym(0, 'spin_callback')
assert(callback_address)

const nArgs = 4
const ctx = ptr(new Uint8Array(((nArgs + 3) * 8)))
const dv = new DataView(ctx.buffer)
const ctxu32 = new Uint32Array(ctx.buffer, 24, 2)
const cu32 = new Uint32Array(ctx.buffer, 32, 1)
const fu32 = new Uint32Array(ctx.buffer, 40, 2)
const nu32 = new Uint32Array(ctx.buffer, 48, 2)
registerCallback(ctx.ptr, callback2)

const bytes = ptr(new Uint8Array([
  // movabs (address of context), %rax
  0x48, 0xb8, ...address_as_bytes(ctx.ptr),
  // mov %rdi, 24(%rax)
  0x48, 0x89, 0x78, 0x18,
  // mov %rsi, 32(%rax)
  0x48, 0x89, 0x70, 0x20,
  // mov %rdx, 40(%rax)
  0x48, 0x89, 0x50, 0x28,
  // mov %rcx, 48(%rax)
  0x48, 0x89, 0x48, 0x30,
  // mov %rax, %rdi
  0x48, 0x89, 0xc7,
  // mov %rax, %r15
  0x49, 0x89, 0xc7,
  // call {callback_address}
  ...asm.reset().call(callback_address).bytes(),
  // mov 16(%r15), %rax
  0x49, 0x8b, 0x47, 0x10,
  // ret
  0xc3
]))

const address = asm.compile(bytes)
const encoder = new TextEncoder()
const sql = ptr(encoder.encode('pragma user_version'))
const sqlptr = sql.ptr
const hptr = ptr(u32).ptr

run('user_version_callback', () => exec3(db, sqlptr, address, 0, hptr), 3000000, 10)
//run('user_version_no_callback', () => exec4(db, sqlptr, 0, 0, hptr), 3000000, 10)

// 1.689m ops/sec for no callback exec
// 1.113m ops/sec for callback2
// 0.764m ops/sec for callback
