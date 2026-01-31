// COMPAT
let constants = {}
let stat
if (globalThis.lo) {
  globalThis.readFileSync = lo.core.read_file
  const { file_stat } = await import('lib/fs.js')
  stat = file_stat
  globalThis.args = lo.args.slice(2)
  constants.S_IFBLK = lo.core.S_IFBLK
  constants.S_IFCHR = lo.core.S_IFCHR
  constants.S_IFIFO = lo.core.S_IFIFO
  constants.S_IFMT = lo.core.S_IFMT
  constants.S_IFDIR = lo.core.S_IFDIR
  constants.S_IFREG = lo.core.S_IFREG
  constants.S_IRUSR = lo.core.S_IRUSR
  constants.S_IWUSR = lo.core.S_IWUSR
  constants.S_IXUSR = lo.core.S_IXUSR
  constants.S_IRGRP = lo.core.S_IRGRP
  constants.S_IWGRP = lo.core.S_IWGRP
  constants.S_IXGRP = lo.core.S_IXGRP
  constants.S_IROTH = lo.core.S_IROTH
  constants.S_IWOTH = lo.core.S_IWOTH
  constants.S_IXOTH = lo.core.S_IXOTH
  constants.S_IRWXU = lo.core.S_IRWXU
  constants.S_IRWXG = lo.core.S_IRWXG
  constants.S_IRWXO = lo.core.S_IRWXO
  constants.O_WRONLY = lo.core.O_WRONLY
  constants.O_RDONLY = lo.core.O_RDONLY
  constants.O_RDWR = lo.core.O_RDWR
  constants.O_CREAT = lo.core.O_CREAT
  constants.O_TRUNC = lo.core.O_TRUNC
} else {
  const fs = await import('node:fs')
  stat = fs.statSync
  globalThis.readFileSync = fs.readFileSync
  globalThis.args = process.argv.slice(2)
  constants.S_IFBLK = fs.constants.S_IFBLK
  constants.S_IFCHR = fs.constants.S_IFCHR
  constants.S_IFIFO = fs.constants.S_IFIFO
  constants.S_IFMT = fs.constants.S_IFMT
  constants.S_IFDIR = fs.constants.S_IFDIR
  constants.S_IFREG = fs.constants.S_IFREG
  constants.S_IRUSR = fs.constants.S_IRUSR
  constants.S_IWUSR = fs.constants.S_IWUSR
  constants.S_IXUSR = fs.constants.S_IXUSR
  constants.S_IRGRP = fs.constants.S_IRGRP
  constants.S_IWGRP = fs.constants.S_IWGRP
  constants.S_IXGRP = fs.constants.S_IXGRP
  constants.S_IROTH = fs.constants.S_IROTH
  constants.S_IWOTH = fs.constants.S_IWOTH
  constants.S_IXOTH = fs.constants.S_IXOTH
  constants.S_IRWXU = fs.constants.S_IRWXU
  constants.S_IRWXG = fs.constants.S_IRWXG
  constants.S_IRWXO = fs.constants.S_IRWXO
  constants.O_WRONLY = fs.constants.O_WRONLY
  constants.O_RDONLY = fs.constants.O_RDONLY
  constants.O_RDWR = fs.constants.O_RDWR
  constants.O_CREAT = fs.constants.O_CREAT
  constants.O_TRUNC = fs.constants.O_TRUNC
}

const {
  S_IFBLK,
  S_IFCHR,
  S_IFIFO,
  S_IFMT ,
  S_IFDIR,
  S_IFREG,
  S_IRUSR,
  S_IWUSR,
  S_IXUSR,
  S_IRGRP,
  S_IWGRP,
  S_IXGRP,
  S_IROTH,
  S_IWOTH,
  S_IXOTH,
  S_IRWXU,
  S_IRWXG,
  S_IRWXO,
  O_WRONLY,
  O_RDONLY,
  O_RDWR,
  O_CREAT,
  O_TRUNC
} = constants

const encoder = new TextEncoder()
const decoder = new TextDecoder()
globalThis.decode_utf8 = (bytes, off, sz) => {
  return decoder.decode(bytes.subarray(off, off + sz))
}

const AD = "\u001b[0m" // ANSI Default
const AG = "\u001b[32m" // ANSI Green
const AY = "\u001b[33m" // ANSI Yellow
const AC = "\u001b[36m" // ANSI Cyan
// END OF COMPAT

// SRV4 ASCII CPIO Format

// https://github.com/libyal/dtformats/blob/main/documentation/Copy%20in%20and%20out%20(CPIO)%20archive%20format.asciidoc#5-mode-permissions-and-type
/*
0170000  This masks the file type bits.
0140000  File type value for sockets.
0120000  File type value for symbolic links.  For symbolic links,
         the link body is stored as file data.
0100000  File type value for regular files.
0060000  File type value for block special devices.
0040000  File type value for directories.
0020000  File type value for character special devices.
0010000  File type value for named pipes or FIFOs.
0004000  SUID bit.
0002000  SGID bit.
0001000  Sticky bit.  On some systems, this modifies the behavior
         of executables and/or directories.
0000777  The lower 9 bits specify read/write/execute permissions
         for world, group, and user following standard POSIX con-
         ventions.
*/

function get_file_type (val) {
  const type = val & IF_TYPE
  if (type === IF_SOCK) return 'sck'
  if (type === IF_LINK) return 'sym'
  if (type === IF_REG) return 'reg'
  if (type === IF_BLK) return 'blk'
  if (type === IF_DIR) return 'dir'
  if (type === IF_CHR) return 'chr'
  if (type === IF_PIPE) return 'pip'
  return ''
}

function get_bits (val) {
  const suid = val & IF_SUID
  const sgid = val & IF_SGID
  const sticky = val & IF_STICKY
  return { suid, sgid, sticky }
}

function perms (p) {
  const { r, w, x } = mode
  return `${(p & r) === r ? 'r' : '-'}${(p & w) === w ? 'w' : '-'}${(p & x) === x ? 'x' : '-'}`
}

function get_perms (val) {
  const perm = val & IF_PERM
  const u = perm >> 6
  const g = (perm >> 3) & 0x07
  const w = perm & 0x07
  return [u, g, w].map(perms)
}

function parse_cpio (bytes) {
  function octal (sz) {
    const val = Number(`0o${decode_utf8(bytes, off, sz)}`)
    off += sz
    return val
  }

  function hex (sz) {
    const val = Number(`0x${decode_utf8(bytes, off, sz)}`)
    off += sz
    return val
  }

  function string (sz) {
    const str = decode_utf8(bytes, off, sz)
    off += sz + 1
    return str
  }

  function align () {
    const over = off % 4
    if (over === 0) return
    off += 4 - over
  }

  function buffer (sz) {
    const buf =  bytes.subarray(off, off + sz)
    off += sz
    return buf
  }

  let off = 0
  const files = []

  while (off < bytes.length) {
    // can be "070701" (no checksums) or "070702" (with checksums)
    const id = octal(6)
    if (id !== 29121 && id !== 29122) throw new Error('Unrecognized file id')
    const inode = hex(8)
    const mode = hex(8)
    const type = get_file_type(mode)
    const perms = get_perms(mode)
    const { suid, sgid, sticky } = get_bits(mode)
    const uid = hex(8)
    const gid = hex(8)
    const links = hex(8)
    const mod = new Date(hex(8) * 1000)
    const size = hex(8)
    const major = hex(8)
    const minor = hex(8)
    const dev_major = hex(8)
    const dev_minor = hex(8)
    const path_size = hex(8)
    const checksum = hex(8) // will only be set if id is "070702"
    const path = string(path_size - 1)
    if (path === 'TRAILER!!!') break
    const file = { 
      id, inode, mode, uid, gid, links, mod, size, major, minor, dev_major, 
      dev_minor, path_size, checksum, path, type, perms,
      suid, sgid, sticky
    }
    align()
    if (type === 'link') {
      file.link_path = string(size)
    } else {
      file.data = buffer(size)
    }
    align()
    files.push(file)
  }
  return files
}

function build_cpio (entries) {
  function octal (n, sz) {
    const str = n.toString(8).padStart(sz, '0')
    off += sz
    return str
  }

  function hex (n, sz) {
    const str = n.toString(16).padStart(sz, '0')
    off += sz
    return str
  }

  function string (s) {
    const str = `${s}\0`
    off += str.length // TODO - UTF8
    return str
  }

  function align () {
    const over = off % 4
    if (over === 0) return
    off += 4 - over
  }

  function buffer (b) {
    off += b.length
    return b
  }

  function get_type (entry) {
    const { type } = entry
    if (type === 'reg') return S_IFREG
    if (type === 'dir') return S_IFDIR
    if (type === 'blk') return S_IFBLK
    if (type === 'chr') return S_IFCHR
    return S_IFREG
  }

  function get_perms (entry) {
    const { type, exe } = entry
    if (type === 'reg') {
      if (exe) return S_IRUSR | S_IWUSR | S_IXUSR | S_IRGRP | S_IWGRP | S_IXGRP | S_IROTH | S_IXOTH
      return S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH
    }
    if (type === 'dir') return S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH
    if (type === 'blk') return S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH
    if (type === 'chr') return S_IRUSR | S_IWUSR | S_IRGRP | S_IWGRP | S_IROTH
    return 0
  }

  function get_size (entry) {
    const { type } = entry
    if (type === 'reg') {
      const st = stat(entry.source)
      return st.size
    }
    return 0
  }

  function get_dev (entry) {
    if (entry.type !== 'chr' && entry.type !== 'blk') return { major: 0, minor: 0 }
    const [ major, minor ] = entry.dev.split('.').map(v => parseInt(v, 10))
    return { major, minor }
  }
  function create_entry (entry) {
    off = 0
    const id = octal(29121, 6)
    const inode = hex(next_inode++, 8)
    const mode = hex(get_perms(entry) | get_type(entry), 8)
    const uid = hex(0, 8)
    const gid = hex(0, 8)
    const links = hex(0, 8)
    const mod = hex(Math.floor(Date.now() / 1000), 8)
    const size = hex(get_size(entry), 8)
    const dev = get_dev(entry)
    const major = hex(8, 8)
    const minor = hex(1, 8)
    const dev_major = hex(dev.major, 8)
    const dev_minor = hex(dev.minor, 8)
    const path_size = hex(entry.path.length + 1, 8)
    const checksum = hex(0, 8)
    const path = string(entry.path)
    let payload
    align()
    if (entry.type === 'link') {
      payload = encoder.encode(string(entry.link_path))
    } else if (entry.type === 'reg') {
      payload = buffer(readFileSync(entry.source))
    }
    align()
    const dest = new Uint8Array(off)
    const text = `${id}${inode}${mode}${uid}${gid}${links}${mod}${size}${major}${minor}${dev_major}${dev_minor}${path_size}${checksum}${path}`
    const { written } = encoder.encodeInto(text, dest)
    off = written
    align()
    if (payload) dest.set(payload, off)
    return dest
  }

  const sections = []
  let off = 0
  let next_inode = 1
  for (const entry of entries) {
    sections.push(create_entry(entry))
  }
  sections.push(create_entry({ path: 'TRAILER!!!' }))
  return sections
}

function col (type, perms) {
  if (type === 'reg') {
    if (perms) {
      const executable = perms.map(p => p.split('')[2]).includes('x')
      if (executable) return AG
    }
    return AD
  }
  if (type === 'dir') return AC
  if (type === 'link') return AG
  if (type === 'sock') return AG
  if (type === 'chr') return AY
  return AY
}

function header () {
  const fields = []
  fields.push('path'.padEnd(40, ' '))
  fields.push('type'.padEnd(6, ' '))
  fields.push('inode'.padEnd(10, ' '))
  fields.push('size'.padStart(20, ' '))
  fields.push('modified'.padStart(30, ' '))
  fields.push('perm'.padStart(10, ' '))
  fields.push('ver'.padStart(6, ' '))
  fields.push('dev'.padStart(6, ' '))
  fields.push('uid'.padStart(8, ' '))
  fields.push('gid'.padStart(8, ' '))
  fields.push('links'.padStart(6, ' '))
  fields.push('suid'.padStart(4, ' '))
  fields.push('sgid'.padStart(4, ' '))
  fields.push('stky'.padStart(4, ' '))
  return `${AG}${fields.join(' ')}${AD}\n${'-'.repeat(168)}`
}

function dump_file (file) {
  const { 
    path, inode, type, size, mod, perms, major, minor, dev_major, dev_minor, uid, gid, links, 
    suid, sgid, sticky 
  } = file
  const fields = []
  fields.push(`${col(type, perms)}${path.padEnd(40, ' ')}${AD}`)
  fields.push(`${type.padEnd(6, ' ')}`)
  fields.push(`${inode.toString().padEnd(10, ' ')}`)
  fields.push(`${size.toString().padStart(20, ' ')}`)
  fields.push(`${AY}${mod.toISOString().padStart(30, ' ')}${AD}`)
  fields.push(`${perms.join('').padStart(10, ' ')}`)

  fields.push(`${(major + "." + minor).padStart(6, ' ')}`)
  fields.push(`${(dev_major + "." + dev_minor).padStart(6, ' ')}`)
  fields.push(`${uid.toString().padStart(8, ' ')}`)
  fields.push(`${gid.toString().padStart(8, ' ')}`)
  fields.push(`${links.toString().padStart(6, ' ')}`)
  fields.push(`${suid.toString().padStart(4, ' ')}`)
  fields.push(`${sgid.toString().padStart(4, ' ')}`)
  fields.push(`${sticky.toString().padStart(4, ' ')}`)
  return fields.join(' ')
}

const mode = { x: 1, w: 2, r: 4 }
const IF_TYPE = 0o170000
const IF_SOCK = 0o140000
const IF_LINK = 0o120000
const IF_REG = 0o100000
const IF_BLK = 0o060000
const IF_DIR = 0o040000
const IF_CHR = 0o020000
const IF_PIPE = 0o010000
const IF_SUID = 0o004000
const IF_SGID = 0o002000
const IF_STICKY = 0o001000
const IF_PERM = 0o000777

function dump_cpio (path) {
  const files = parse_cpio(readFileSync(path))
  let total = 0
  console.log(header())
  for (const file of files) {
    console.log(dump_file(file))
    total += file.size
  }
  console.log(`\ntotal: ${total}`)
}

export { parse_cpio, build_cpio, dump_cpio }
