// Shared helpers for test/strings: a reference UTF-8 encoder, the kinds of
// V8 string the tests feed to every route, libc bindings that take raw byte
// pointers (so files can be created with exact names), and reporting.
//
// Run the tests from the repo root (bare specifiers, like test/import.js).

import { bind } from 'lib/ffi.js'
import { readdir_sync } from 'lib/fs.js'

const { core, assert, ptr } = lo

// --- reference UTF-8 (WHATWG encode: an unpaired surrogate becomes U+FFFD) ---

function utf8_bytes (str) {
  const out = []
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const d = str.charCodeAt(i + 1)
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00)
        i++
      } else {
        c = 0xfffd
      }
    } else if (c >= 0xd800 && c <= 0xdfff) {
      c = 0xfffd
    }
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
  }
  return new Uint8Array(out)
}

// the string a correct UTF-8 round trip gives back (unpaired surrogates -> U+FFFD)
function utf8_round_trip (str) {
  let out = ''
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const d = str.charCodeAt(i + 1)
      if (d >= 0xdc00 && d <= 0xdfff) { out += str[i] + str[i + 1]; i++; continue }
    }
    out += (c >= 0xd800 && c <= 0xdfff) ? '�' : str[i]
  }
  return out
}

// a NUL-terminated copy of bytes, with .ptr
function c_bytes (bytes) {
  const u8 = new Uint8Array(bytes.length + 1)
  u8.set(bytes)
  return ptr(u8)
}

function same_bytes (a, b, len = b.length) {
  if (len !== b.length) return false
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) return false
  return true
}

function hex (bytes, max = 24) {
  const n = Math.min(bytes.length, max)
  let s = ''
  for (let i = 0; i < n; i++) s += (i ? ' ' : '') + bytes[i].toString(16).padStart(2, '0')
  return bytes.length > max ? `${s} ... (${bytes.length} bytes)` : s
}

// --- kinds of string ---------------------------------------------------------
//
// V8 takes a string fast call only for a *sequential one-byte* string, checked
// per call in TurboFan code. Every other representation makes the slow call:
// cons (+ at 13 characters or more), sliced (slice() of 13 or more), two-byte.

const ch = String.fromCharCode
const E_ACUTE = ch(0xe9) // é, Latin-1: one-byte string
const A_MACRON = ch(0x101) // ā, two-byte string
const GRINNING = ch(0xd83d, 0xde00) // U+1F600, a surrogate pair
const LONE = ch(0xd800) // an unpaired surrogate

// a sequential (flat) copy: join() builds a new SeqString
function flat (s) {
  return s.split('').join('')
}

// cons: built fresh on every call by +, so it is always a ConsString when
// the result has 13 or more characters
function cons_of (s) {
  if (s.length < 13) return null
  const mid = s.length >> 1
  const a = flat(s.slice(0, mid))
  const b = flat(s.slice(mid))
  return { a, b }
}

// sliced: a slice of 13 or more characters of a longer flat string
function sliced_of (s) {
  if (s.length < 13) return null
  return flat(`${s}#tail`).slice(0, s.length)
}

// ASCII text of exactly len characters
function ascii (len, seed = 'abcdefghijklmnopqrstuvwxyz0123456789') {
  let s = ''
  while (s.length < len) s += seed
  return flat(s.slice(0, len))
}

// text of len characters with every 4th character replaced by c
function mixed (len, c) {
  let s = ''
  for (let i = 0; i < len; i++) s += (i % 4 === 3) ? c : 'abcdefgh'[i % 8]
  return flat(s)
}

// --- libc through FFI, with byte pointers (exact names, no string conversion) --

const libc = {}
function libc_bind () {
  if (libc.ready) return libc
  const sym = name => assert(core.dlsym(0, name), `dlsym ${name}`)
  libc.strnlen_str = bind(sym('strnlen'), 'u32', ['string', 'u32'])
  libc.access_str = bind(sym('access'), 'i32', ['string', 'i32'])
  libc.creat = bind(sym('creat'), 'i32', ['pointer', 'u32'])
  // unlink(pointer) through FFI fails with EFAULT (one 'pointer' parameter,
  // 2026-11-08, not investigated); unlinkat(AT_FDCWD, path, 0) works
  libc.unlinkat = bind(sym('unlinkat'), 'i32', ['i32', 'pointer', 'i32'])
  libc.symlink = bind(sym('symlink'), 'i32', ['pointer', 'pointer'])
  libc.ready = true
  return libc
}

// create (or remove) a file whose name is exactly utf8_bytes(path)
function create_exact (path) {
  const p = c_bytes(utf8_bytes(path))
  const fd = libc_bind().creat(p.ptr, 0o644)
  assert(fd > 0, `creat failed for ${hex(utf8_bytes(path))}: errno ${lo.errno}`)
  core.close(fd)
}

function unlink_exact (path) {
  return libc_bind().unlinkat(-100, c_bytes(utf8_bytes(path)).ptr, 0)
}

// an empty directory at path: a leftover from an interrupted run is emptied
// first (names come back from readdir_sync decoded, and are removed by their
// UTF-8 bytes; lib/fs.js gives a symlink's full path in .path)
function fresh_dir (path) {
  if (core.access(path, 0) === 0) {
    for (const e of readdir_sync(path, [], { recursive: false })) {
      unlink_exact(e.isLink ? e.path : `${path}/${e.name}`)
    }
    assert(core.rmdir(path) === 0, `could not remove leftover ${path}: errno ${lo.errno}`)
  }
  assert(core.mkdir(path, 0o755) === 0, `could not create ${path}: errno ${lo.errno}`)
}

// --- running checks ------------------------------------------------------------

// Each hot check is a loop over entries [{ label, ... }]; index 0 is a canary
// that must fail every time, so the failure branch has type feedback before
// the first real failure (otherwise V8 deopts there and the fast path may
// never be taken again). Results per entry: failure count, first failing
// iteration, and a detail value from that first failure.
function results (n) {
  return { count: new Uint32Array(n), first: new Int32Array(n).fill(-1), detail: new Array(n).fill(null) }
}

let failures = 0

// entries[0] is the canary. Iteration 0 runs before optimisation (slow
// path); a first failure later than that means the optimised code's fast
// path got it wrong.
function report (name, entries, r, iterations) {
  assert(r.count[0] === iterations, `${name}: canary failed ${r.count[0]} of ${iterations} times`)
  const bad = []
  for (let j = 1; j < entries.length; j++) {
    if (!r.count[j]) continue
    bad.push(`       ${entries[j].label}: ${r.count[j]} of ${iterations} wrong, first at ${r.first[j] === 0 ? 'iteration 0 (cold: slow path)' : `iteration ${r.first[j]} (optimised)`}${r.detail[j] === null ? '' : `, ${r.detail[j]}`}`)
  }
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${name} (${entries.length - 1} strings x ${iterations})`)
  for (const line of bad) console.log(line)
  failures += bad.length ? 1 : 0
}

// extra: failed checks counted by the caller (e.g. one-shot decode checks)
function finish (extra = 0) {
  const total = failures + extra
  console.log(total ? `FAILED: ${total} check(s)` : 'all passed')
  lo.exit(total ? 1 : 0)
}

// --- options -----------------------------------------------------------------

// --no-fast: every call slow (--no-turbo-fast-api-calls), as a control.
// Maglev is always off: only TurboFan code makes string fast calls, and a
// loop can stay in Maglev for a whole run.
function options (defaults = {}) {
  const args = lo.args.slice(2)
  const no_fast = args.includes('--no-fast')
  if (no_fast) lo.setFlags('--no-turbo-fast-api-calls')
  lo.setFlags('--no-maglev')
  const rest = args.filter(a => !a.startsWith('--'))
  const iterations = parseInt(rest[0] || defaults.iterations || '100000', 10)
  console.log(`${no_fast ? 'fast calls OFF (--no-turbo-fast-api-calls)' : 'fast calls on'}, maglev off, ${iterations} iterations`)
  return { no_fast, iterations }
}

export {
  utf8_bytes, utf8_round_trip, c_bytes, same_bytes, hex,
  E_ACUTE, A_MACRON, GRINNING, LONE, flat, cons_of, sliced_of, ascii, mixed,
  libc_bind, create_exact, unlink_exact, fresh_dir,
  results, report, finish, options
}
