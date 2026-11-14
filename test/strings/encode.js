// JS strings into C: every route must hand C the string's UTF-8 bytes, and
// C-string routes must add a NUL (PLAN task 144, task 138 for the intrinsics).
//
//   ./lo test/strings/encode.js [--no-fast] [iterations]
//
// Routes:
//   binding  generated fast/slow calls: core.strnlen_str (length), core.access (exact name)
//   ffi      lib/ffi.js bind() with a 'string' parameter: strnlen, access
//   lo       intrinsics: utf8Length, utf8EncodeInto, utf8Encode, TextEncoder, cstr
// Every check runs in a hot loop with Maglev off, so iteration 0 takes the
// slow path and later iterations the TurboFan fast path where V8 allows one
// (only sequential one-byte strings). Exits 1 if anything is wrong.

import {
  utf8_bytes, c_bytes, same_bytes, hex,
  E_ACUTE, A_MACRON, GRINNING, LONE, flat, cons_of, sliced_of, ascii, mixed,
  libc_bind, create_exact, unlink_exact, fresh_dir,
  results, report, finish, options
} from 'test/strings/common.js'

const { core } = lo
const { iterations } = options()
const libc = libc_bind()
const MAX = 1 << 20
const F_OK = 0

// --- the strings ---------------------------------------------------------------

// { label, s } for a stored string, or { label, a, b } for a cons built per call
function kinds () {
  const list = []
  for (let len = 1; len <= 16; len++) list.push({ label: `seq ascii, length ${len}`, s: ascii(len) })
  for (const len of [3, 4, 5, 8, 13, 16]) list.push({ label: `seq latin1, length ${len}`, s: mixed(len, E_ACUTE) })
  for (const len of [4, 8, 16]) list.push({ label: `two-byte, length ${len}`, s: mixed(len, A_MACRON) })
  list.push({ label: 'two-byte, surrogate pair', s: flat(`ab${GRINNING}cd`) })
  list.push({ label: 'two-byte, unpaired surrogate', s: flat(`ab${LONE}cd`) })
  for (const [kind, s] of [['ascii', ascii(20)], ['latin1', mixed(20, E_ACUTE)]]) {
    const c = cons_of(s)
    list.push({ label: `cons ${kind}, length 20`, a: c.a, b: c.b })
    list.push({ label: `sliced ${kind}, length 20`, s: sliced_of(s) })
  }
  list.push({ label: 'empty', s: '' })
  for (const len of [5000, 70000]) list.push({ label: `seq ascii, length ${len}`, s: ascii(len) })
  list.push({ label: 'seq latin1, length 5000', s: mixed(5000, E_ACUTE) })
  return list.map(e => ({ ...e, want: utf8_bytes(e.b === undefined ? e.s : e.a + e.b) }))
}

const all = kinds()

// --- length: binding, ffi, lo.utf8Length ---------------------------------------

function len_entries () {
  return [{ label: 'canary', s: 'canary', want_len: -1 }, ...all.map(e => ({ ...e, want_len: e.want.length }))]
}

function hot_len_binding (entries, n, r) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]
      const got = core.strnlen_str(e.b === undefined ? e.s : e.a + e.b, MAX)
      if (got !== e.want_len) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `got ${got}, want ${e.want_len}` }
      }
    }
  }
}

function hot_len_ffi (entries, n, r) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]
      const got = libc.strnlen_str(e.b === undefined ? e.s : e.a + e.b, MAX)
      if (got !== e.want_len) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `got ${got}, want ${e.want_len}` }
      }
    }
  }
}

function hot_len_lo (entries, n, r) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]
      const got = lo.utf8Length(e.b === undefined ? e.s : e.a + e.b)
      if (got !== e.want_len) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `got ${got}, want ${e.want_len}` }
      }
    }
  }
}

// --- exact bytes, through the filesystem: binding, ffi -------------------------
// Each name is created with its exact UTF-8 bytes (libc creat on a byte
// pointer); access() on the JS string finds it only if C got those bytes.

const dir = '/tmp/lo-test-strings-encode'

function fs_entries () {
  fresh_dir(dir)
  const entries = [{ label: 'canary', s: flat(`${dir}/missing`) }]
  for (const e of all) {
    if (!e.want.length || e.want.length > 200) continue
    const name = e.b === undefined ? e.s : e.a + e.b
    create_exact(`${dir}/${name}`)
    // the path keeps the entry's representation: cons stays cons, sliced stays sliced
    if (e.b !== undefined) entries.push({ label: e.label, a: flat(`${dir}/${e.a}`), b: e.b, name })
    else if (e.label.startsWith('sliced')) entries.push({ label: e.label, s: sliced_of(`${dir}/${name}`), name })
    else entries.push({ label: e.label, s: flat(`${dir}/${name}`), name })
  }
  return entries
}

function hot_access_binding (entries, n, r) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]
      if (core.access(e.b === undefined ? e.s : e.a + e.b, F_OK) !== 0) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `errno ${lo.errno}` }
      }
    }
  }
}

function hot_access_ffi (entries, n, r) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]
      if (libc.access_str(e.b === undefined ? e.s : e.a + e.b, F_OK) !== 0) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `errno ${lo.errno}` }
      }
    }
  }
}

// --- exact bytes, into memory: lo intrinsics -----------------------------------

const out = lo.ptr(new Uint8Array(3 * 70000 + 16))

function bytes_entries () {
  return [{ label: 'canary', s: 'canary', want: new Uint8Array(0), canary: true }, ...all]
}

// written length, and the bytes (all of them up to 64, else the first and last 32)
function check_bytes (got, got_len, want) {
  if (got_len !== want.length) return false
  if (want.length <= 64) return same_bytes(got, want, got_len)
  for (let k = 0; k < 32; k++) {
    if (got[k] !== want[k] || got[got_len - 1 - k] !== want[want.length - 1 - k]) return false
  }
  return true
}

function hot_encode_into (entries, n, r) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]
      const written = lo.utf8EncodeInto(e.b === undefined ? e.s : e.a + e.b, out.ptr)
      if (e.canary || !check_bytes(out, written, e.want)) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `got ${hex(out.subarray(0, Math.max(written, 0)))}, want ${hex(e.want)}` }
      }
    }
  }
}

function hot_encode (entries, n, r) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]
      const got = lo.utf8Encode(e.b === undefined ? e.s : e.a + e.b)
      if (e.canary || !check_bytes(got, got.length, e.want)) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `got ${hex(got)}, want ${hex(e.want)}` }
      }
    }
  }
}

function hot_text_encoder (entries, n, r) {
  const encoder = new TextEncoder()
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]
      const got = encoder.encode(e.b === undefined ? e.s : e.a + e.b)
      if (e.canary || !check_bytes(got, got.length, e.want)) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `got ${hex(got)}, want ${hex(e.want)}` }
      }
    }
  }
}

// cstr: the UTF-8 bytes plus a NUL
function hot_cstr (entries, n, r) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      const e = entries[j]
      const got = lo.cstr(e.b === undefined ? e.s : e.a + e.b)
      const ok = got.length === e.want.length + 1 && got[e.want.length] === 0 &&
        check_bytes(got, e.want.length, e.want)
      if (e.canary || !ok) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `got ${hex(got)}, want ${hex(e.want)} 00` }
      }
    }
  }
}

// --- run -------------------------------------------------------------------------

function run (name, entries, loop, n) {
  const r = results(entries.length)
  loop(entries, n, r)
  report(name, entries, r, n)
}

const lens = len_entries()
run('binding core.strnlen_str: UTF-8 length', lens, hot_len_binding, iterations)
run('ffi strnlen(string): UTF-8 length', lens, hot_len_ffi, iterations)
run('lo.utf8Length', lens, hot_len_lo, iterations)

const files = fs_entries()
const fs_iterations = Math.max(1000, iterations >> 3)
run('binding core.access: exact UTF-8 name', files, hot_access_binding, fs_iterations)
run('ffi access(string): exact UTF-8 name', files, hot_access_ffi, fs_iterations)

const byte_entries = bytes_entries()
const mem_iterations = Math.max(1000, iterations >> 4)
run('lo.utf8EncodeInto: UTF-8 bytes', byte_entries, hot_encode_into, mem_iterations)
run('lo.utf8Encode: UTF-8 bytes', byte_entries, hot_encode, mem_iterations >> 2)
run('TextEncoder.encode: UTF-8 bytes', byte_entries, hot_text_encoder, mem_iterations >> 2)
run('lo.cstr: UTF-8 bytes + NUL', byte_entries, hot_cstr, mem_iterations >> 2)

// cleanup: names removed by their exact bytes
for (const e of files.slice(1)) unlink_exact(`${dir}/${e.name}`)
core.rmdir(dir)

finish()
