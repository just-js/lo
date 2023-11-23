const { assert, readMemory, utf8Decode, wrap } = lo
const { 
  closedir, unlink, rmdir, open, fstat, close, access, mkdir,
  F_OK, O_RDONLY, S_IFMT, S_IFDIR, S_IFREG
} = lo.core

const handle = new Uint32Array(2)
const opendir = wrap(handle, lo.core.opendir, 1)
const readdir = wrap(handle, lo.core.readdir, 1)
const u8 = new Uint8Array(19)
const dir_view = new DataView(u8.buffer)
const stat = new Uint8Array(160)
const stat32 = new Uint32Array(stat.buffer)

function checkMode (val, mode) {
  return (val & S_IFMT) === mode
}

function readEntry (handle) {
  readMemory(u8, handle, 19)
  const d_ino = dir_view.getUint32(0, true)
  const d_off = dir_view.getUint32(8, true)
  const d_reclen = dir_view.getUint16(16, true)
  const d_type = u8[18]
  const name = utf8Decode(handle + 19, -1)
  return { d_ino, d_off, d_reclen, d_type, name }
}

function isFile (path) {
  const fd = open(path)
  if (fd <= 2) return false
  if (fstat(fd, stat) !== 0) return false
  close(fd)
  return checkMode(stat32[6], S_IFREG)
}

function isDir (path) {
  if (access(path, F_OK) !== 0) return false
  const fd = open(path, O_RDONLY)
  if (fd < 1) return false
  const r = fstat(fd, stat)
  if (r < 0) return false
  close(fd)
  return checkMode(stat32[6], S_IFDIR)
}

function mkDirAll (full_path, fileMode) {
  const subdirs = full_path.split('/').filter(dir => dir)
  let path = ''
  for (const dir of subdirs) {
    path = `${path}${dir}/`
    if (isDir(path)) rmDirAll(path)
    console.log(`mkdir ${path}`)
    if (mkdir(path, fileMode) !== 0) {
      throw new Error(`could not make directory ${path}: errno ${lo.errno}`)
    }
  }
}

// todo: check all paths before deletion or removal - must be relative
//       and no traversal above current allowed
function rmDir (path) {
  const dir = opendir(path)
  assert(dir)
  let next = readdir(dir)
  assert(next)
  let directories = []
  while (next) {
    const entry = readEntry(next)
    if (!(entry.name === '..' || entry.name === '.')) {
      const entry_path = `${path}/${entry.name}`
      if (entry.d_type === 4) {
        directories.push(entry_path)
        directories = directories.concat(rmDir(entry_path))
      } else if (entry.d_type === 8) {
        assert(unlink(entry_path) === 0)
      }
    }
    next = readdir(dir)
  }
  assert(closedir(dir) === 0)
  return directories
}

function str_compare(a, b) {
  return a < b ? 1 : (a === b ? 0 : -1)
}

function rmDirAll (path) {
  if (!isDir(path)) return
  const dirs = rmDir(path).sort(str_compare)
  for (const dir_path of dirs) {
    assert(rmdir(dir_path) === 0)
  }
  assert(rmdir(path) === 0)
}

export { mkDirAll, rmDirAll, isFile, isDir }
