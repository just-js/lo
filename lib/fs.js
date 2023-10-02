const { fs } = spin.load('fs')

const { assert } = spin

const O_RDONLY = 0
const O_WRONLY = 1
const O_CREAT = 64
const O_TRUNC = 512
// TODO: O_APPEND

const S_IRUSR = 256
const S_IWUSR = 128
const S_IXUSR = 64
const S_IRGRP = 32
const S_IWGRP = 16
const S_IXGRP = 8
const S_IROTH = 4
const S_IWOTH = 2
const S_IXOTH = 1
const S_IRWXO = 7
const S_IRWXG = 56
const S_IRWXU = 448


const S_IFMT = 61440
const S_IFSOCK = 49152
const S_IFLNK = 40960
const S_IFREG = 32768
const S_IFBLK = 24576
const S_IFDIR = 16384
const S_IFCHR = 8192
const S_IFIFO = 4096

const defaultWriteFlags = O_WRONLY | O_CREAT | O_TRUNC
const defaultWriteMode = S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH
const defaultFlags = O_RDONLY

const stat = new Uint8Array(160)
const stat32 = new Uint32Array(stat.buffer)
const stat64 = new BigUint64Array(stat.buffer)

const DT_UNKNOWN = 0
const DT_FIFO = 1
const DT_CHR = 2
const DT_DIR = 4
const DT_BLK = 6
const DT_REG = 8
const DT_LNK = 10
const DT_SOCK = 12
const DT_WHT = 14

const st = {}
const fileTypes = {} // lookup for meaningful names of device types
fileTypes[DT_BLK] = 'block'
fileTypes[DT_CHR] = 'character'
fileTypes[DT_DIR] = 'directory'
fileTypes[DT_FIFO] = 'fifo'
fileTypes[DT_LNK] = 'symlink'
fileTypes[DT_REG] = 'regular'
fileTypes[DT_SOCK] = 'socket'
const UNKNOWN = 'unknown'
fileTypes[DT_UNKNOWN] = UNKNOWN
fileTypes[DT_WHT] = 'whiteout'

function checkFlag (val, flag) {
  return (val & flag) === flag
}

function checkMode (val, mode) {
  return (val & S_IFMT) === mode
}

function fileType (type) {
  return fileTypes[type] || UNKNOWN
}

function getStats (stat) {
  st.deviceId = Number(stat64[0])
  st.inode = Number(stat64[1])
  st.nlink = Number(stat64[2])
  st.mode = stat32[6] // 3
  st.uid = stat32[7]
  st.gid = stat32[8] // 4
  st.rdev = Number(stat64[5])
  st.size = Number(stat64[6])
  st.blockSize = Number(stat64[7])
  st.blocks = Number(stat64[8])
  st.accessed = { tv_sec: Number(stat[9]), tv_nsec: Number(stat[10]) }
  st.modified = { tv_sec: Number(stat[11]), tv_nsec: Number(stat[12]) }
  st.created = { tv_sec: Number(stat[13]), tv_nsec: Number(stat[14]) }
  st.permissions = {
    user: {
      r: checkFlag(st.mode, S_IRUSR),
      w: checkFlag(st.mode, S_IWUSR),
      x: checkFlag(st.mode, S_IXUSR)
    },
    group: {
      r: checkFlag(st.mode, S_IRGRP),
      w: checkFlag(st.mode, S_IWGRP),
      x: checkFlag(st.mode, S_IXGRP)
    },
    other: {
      r: checkFlag(st.mode, S_IROTH),
      w: checkFlag(st.mode, S_IWOTH),
      x: checkFlag(st.mode, S_IXOTH)
    }
  }
  st.type = {
    socket: checkMode(st.mode, S_IFSOCK),
    symlink: checkMode(st.mode, S_IFLNK),
    regular: checkMode(st.mode, S_IFREG),
    block: checkMode(st.mode, S_IFBLK),
    directory: checkMode(st.mode, S_IFDIR),
    character: checkMode(st.mode, S_IFCHR),
    fifo: checkMode(st.mode, S_IFIFO)
  }
  return st
}

function readFileSlice (path, size = 0, flags = O_RDONLY) {
  const fd = fs.open(path, flags)
  assert(fd > 0)
  const buf = new Uint8Array(size)
  let off = 0
  let len = fs.read(fd, buf, size)
  while (len > 0) {
    off += len
    if (off === size) break
    len = fs.read(fd, buf, size)
  }
  off += len
  const r = fs.close(fd)
  assert(r === 0)
  assert(off >= size)
  return buf
}

function readFile (path, flags = O_RDONLY) {
  const fd = fs.open(path, flags)
  assert(fd > 0)
  let r = fs.fstat(fd, stat)
  assert(r === 0)
  const size = Number(stat32[12])
  const buf = new Uint8Array(size)
  let off = 0
  let len = fs.read(fd, buf, size)
  while (len > 0) {
    off += len
    if (off === size) break
    len = fs.read(fd, buf, size)
  }
  off += len
  r = fs.close(fd)
  assert(r === 0)
  assert(off >= size)
  return buf
}

function writeFile (path, u8, flags = defaultWriteFlags, mode = defaultWriteMode) {
  const len = u8.length
  if (!len) return -1
  const fd = fs.open(path, flags, mode)
  assert(fd > 0)
  const chunks = Math.ceil(len / 4096)
  let total = 0
  let bytes = 0
  for (let i = 0, off = 0; i < chunks; ++i, off += 4096) {
    const towrite = Math.min(len - off, 4096)
    bytes = fs.write(fd, u8.subarray(off, off + towrite), towrite)
    if (bytes <= 0) break
    total += bytes
  }
  assert(bytes > 0)
  fs.close(fd)
  return total
}

function isDir (path) {
  const fd = fs.open(path, defaultFlags)
  if (fd < 1) return false
  const r = fs.fstat(fd, stat)
  if (r < 0) return false
  fs.close(fd)
  return getStats(stat64).type.directory
}

function isFile (path) {
  const fd = fs.open(path)
  if (fd <= 2) return false
  if (fs.fstat(fd, stat) !== 0) return false
  fs.close(fd)
  return getStats(stat64).type.regular
}

function getStat (path) {
  const fd = fs.open(path)
  if (fd < 1) return false
  const stat = new BigUint64Array(20)
  const r = fs.fstat(fd, stat)
  if (r < 0) return false
  fs.close(fd)
  return getStats(stat64)
}

fs.constants = {
  O_RDONLY
}

fs.opendir = spin.wrap(new Uint32Array(2), fs.opendir, 1)
fs.readdir = spin.wrap(new Uint32Array(2), fs.readdir, 1)

export { fs, getStat, isFile, isDir, readFile, writeFile, readFileSlice }