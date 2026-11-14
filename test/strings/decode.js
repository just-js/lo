// Bytes from C into JS strings, and round trips back out (PLAN task 144).
//
//   ./lo test/strings/decode.js [--no-fast] [iterations]
//
// 1. utf8Decode / TextDecoder: valid UTF-8 gives the string back; invalid
//    sequences give U+FFFD per the WHATWG decoder (maximal subparts).
// 2. latin1Decode: each byte becomes the code unit of the same value.
// 3. encode then decode (lo.utf8Encode -> utf8Decode) is the identity, with
//    unpaired surrogates becoming U+FFFD.
// 4. A real directory: files created with exact UTF-8 names come back from
//    readdir_sync as the same strings, and stat() on those strings finds them
//    (cold and hot), the round trip a tree walker does. Symlink targets too.

import { readdir_sync } from 'lib/fs.js'
import {
  utf8_bytes, utf8_round_trip, c_bytes, hex,
  E_ACUTE, A_MACRON, GRINNING, LONE, flat, ascii, mixed,
  libc_bind, create_exact, unlink_exact, fresh_dir,
  results, report, finish, options
} from 'test/strings/common.js'

const { core, ptr } = lo
const { iterations } = options({ iterations: '50000' })
const st = ptr(new Uint8Array(160))
const ch = String.fromCharCode
const FFFD = '�'

function show (s) {
  return Array.from(s).map(c => c.charCodeAt(0) < 0x80 && c.charCodeAt(0) >= 0x20 ? c : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join('')
}

// --- 1, 2: decoders ------------------------------------------------------------

// [label, bytes, expected string]
const decode_cases = [
  ['ascii', [0x61, 0x62, 0x63], 'abc'],
  ['latin1 range é', [0x63, 0x61, 0x66, 0xc3, 0xa9], `caf${E_ACUTE}`],
  ['two-byte ā', [0x61, 0xc4, 0x81], `a${A_MACRON}`],
  ['astral U+1F600', [0xf0, 0x9f, 0x98, 0x80], GRINNING],
  ['empty', [], ''],
  ['lone continuation byte', [0x61, 0x80, 0x62], `a${FFFD}b`],
  ['truncated 2-byte sequence', [0x61, 0xc3], `a${FFFD}`],
  ['truncated 3-byte sequence', [0xe2, 0x82, 0x61], `${FFFD}a`],
  ['overlong NUL c0 80', [0xc0, 0x80], `${FFFD}${FFFD}`],
  ['encoded surrogate ed a0 80', [0xed, 0xa0, 0x80], `${FFFD}${FFFD}${FFFD}`],
  ['above U+10FFFF f4 90 80 80', [0xf4, 0x90, 0x80, 0x80], `${FFFD}${FFFD}${FFFD}${FFFD}`],
  ['invalid byte ff', [0x61, 0xff, 0x62], `a${FFFD}b`],
]

// mismatches are collected and printed under each section's summary line
let decode_failures = 0
let pending = []
function check (name, got, want) {
  if (got === want) return
  decode_failures++
  pending.push(`       ${name}: got "${show(got)}", want "${show(want)}"`)
}
function summary (ok, line) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`)
  for (const l of pending) console.log(l)
  pending = []
}

function decoders () {
  const decoder = new TextDecoder()
  for (const [label, bytes, want] of decode_cases) {
    const u8 = ptr(new Uint8Array(bytes.length ? bytes : [0]))
    check(`utf8Decode, ${label}`, lo.utf8Decode(u8.ptr, bytes.length), want)
    check(`TextDecoder, ${label}`, decoder.decode(u8.subarray(0, bytes.length)), want)
  }
  // latin1Decode: all 256 byte values
  const all = new Uint8Array(256)
  for (let i = 0; i < 256; i++) all[i] = i
  ptr(all)
  let want = ''
  for (let i = 0; i < 256; i++) want += ch(i)
  check('latin1Decode, bytes 00-ff', lo.latin1Decode(all.ptr, 256), want)
  summary(!decode_failures, `decoders: utf8Decode, TextDecoder, latin1Decode (${decode_cases.length * 2 + 1} cases)`)
}

// --- 3: encode -> decode -------------------------------------------------------

function round_trips () {
  const before = decode_failures
  const strings = [
    ['ascii', ascii(20)], ['latin1', mixed(20, E_ACUTE)], ['two-byte', mixed(20, A_MACRON)],
    ['surrogate pair', flat(`ab${GRINNING}cd`)], ['unpaired surrogate', flat(`ab${LONE}cd`)], ['empty', '']
  ]
  for (const [label, s] of strings) {
    const bytes = lo.utf8Encode(s)
    const u8 = ptr(new Uint8Array(bytes.length ? bytes : [0]))
    check(`utf8Decode(utf8Encode(${label}))`, lo.utf8Decode(u8.ptr, bytes.length), utf8_round_trip(s))
  }
  summary(decode_failures === before, `round trip lo.utf8Encode -> lo.utf8Decode (6 strings)`)
}

// --- 4: through the filesystem -------------------------------------------------

const dir = '/tmp/lo-test-strings-decode'
const names = [
  ascii(4), ascii(8), ascii(13),
  flat(`caf${E_ACUTE}`), flat(`caf${E_ACUTE}s`), mixed(16, E_ACUTE),
  mixed(5, A_MACRON), flat(`x${GRINNING}`)
]

function hot_stat (entries, n, r) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < entries.length; j++) {
      if (core.stat(entries[j].path, st.ptr) !== 0) {
        r.count[j]++
        if (r.first[j] < 0) { r.first[j] = i; r.detail[j] = `errno ${lo.errno}` }
      }
    }
  }
}

function filesystem () {
  fresh_dir(dir)
  for (const name of names) create_exact(`${dir}/${name}`)
  // a symlink whose target has a non-ASCII name
  const target = flat(`target-${E_ACUTE}`)
  const link = 'link'
  libc_bind().symlink(c_bytes(utf8_bytes(target)).ptr, c_bytes(utf8_bytes(`${dir}/${link}`)).ptr)

  const listed = readdir_sync(dir, [], { recursive: false })
  const files = listed.filter(e => e.isFile).map(e => e.name)
  const before = decode_failures
  for (const name of names) {
    if (!files.includes(name)) {
      decode_failures++
      const near = files.find(f => f.length >= name.length - 2 && f.startsWith(name.slice(0, 2)))
      pending.push(`       readdir_sync: "${show(name)}" (${hex(utf8_bytes(name))}) not listed${near ? `, closest "${show(near)}"` : ''}`)
    }
  }
  // lib/fs.js puts a symlink's target in .name
  const links = listed.filter(e => e.isLink)
  check('readdir_sync symlink target', links.length ? links[0].name : '(no symlink listed)', target)
  summary(decode_failures === before, `readdir_sync gives back exact names (${names.length} files, 1 symlink)`)

  // stat every name as readdir_sync returned it, as a tree walker would
  const entries = [{ label: 'canary', path: flat(`${dir}/missing`) },
    ...files.map(name => ({ label: `"${show(name)}"`, path: flat(`${dir}/${name}`) }))]
  const r = results(entries.length)
  hot_stat(entries, iterations, r)
  report('stat(readdir_sync name): the round trip a tree walker does', entries, r, iterations)

  for (const name of names) unlink_exact(`${dir}/${name}`)
  unlink_exact(`${dir}/${link}`)
  core.rmdir(dir)
}

decoders()
round_trips()
filesystem()
if (decode_failures) console.log(`(${decode_failures} decode/round-trip mismatch(es) above)`)
finish(decode_failures)
