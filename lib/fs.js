const { assert, readMemory, utf8Decode, core, ptr } = lo
const { 
  closedir, unlink, rmdir, open, fstat, close, access, mkdir, strnlen, os,
  F_OK, O_RDONLY, S_IFMT, S_IFDIR, S_IFREG,
  S_IRWXU, S_IRWXG, NAME_MAX,
  O_WRONLY, O_CREAT, O_TRUNC, S_IRUSR, S_IWUSR, S_IRGRP, S_IROTH,
  DT_DIR, DT_CHR, DT_REG, DT_FIFO, DT_LNK, DT_BLK, opendir, readdir
} = core

const u8 = ptr(new Uint8Array(21))
const dir_view = new DataView(u8.buffer)
const stat = ptr(new Uint8Array(160))
const stat32 = new Uint32Array(stat.buffer)
const st = new BigUint64Array(stat.buffer)

let MODE_WORD = 6
if (core.os === 'linux' && core.arch === 'arm64') {
  MODE_WORD = 4
} else if (core.os === 'mac') {
  MODE_WORD = 1
}

const write_flags = O_WRONLY | O_CREAT | O_TRUNC
const write_mode = S_IRUSR | S_IWUSR | S_IRGRP | S_IROTH
const read_flags = O_RDONLY
const dir_flags = S_IRWXU | S_IRWXG | S_IROTH

const default_options = { recursive: true }

function checkMode (val, mode) {
  return (val & S_IFMT) === mode
}

function file_size_fd (fd) {
  assert(fstat(fd, stat.ptr) === 0)
  let size = 0
  if (core.os === 'mac') {
    size = Number(st[12])
  } else {
    size = Number(st[6])
  }
  return size
}

function file_mode_fd (fd) {
  assert(fstat(fd, stat.ptr) === 0)
  return stat32[MODE_WORD]
}

function file_size (path) {
  const fd = open(path, O_RDONLY)
  assert(fd > 0, `failed to open ${path}`)
  const size = file_size_fd(fd)
  close(fd)
  return size
}

/*
offset  size  field
------------------------------------
0       8     st_dev
8       8     st_ino
16      8     st_nlink
24      4     st_mode
28      4     st_uid
32      4     st_gid
36      4     padding
40      8     st_rdev
48      8     st_size
56      8     st_blksize
64      8     st_blocks
72      16    st_atim
88      16    st_mtim
104     16    st_ctim
------------------------------------
total: 144 bytes
alignment: 8 bytes
*/
function file_stat (path) {
  assert(core.stat(path, stat.ptr) === 0)
  const dev = Number(st[0]) // 0
  const ino = Number(st[1]) // 8
  const nlink = stat32[4] // 16
  const mode = stat32[6] // 16
  const uid = stat32[7]  // 32
  const gid = stat32[8]  // 36
  const rdev = Number(st[5]) // 40
  const size = Number(st[6])  // 48
  const blksize = Number(st[7]) // 56
  const blocks = Number(st[8]) // 64
  const atim = [st[9], st[10]] // 72
  const mtim = [st[11], st[12]] // 88
  const ctim = [st[13], st[14]] // 104
  return { dev, ino, mode, nlink, uid, gid, rdev, size, blksize, blocks, atim, mtim, ctim }
}

function readdir_sync (path, entries = [], options = default_options) {
  const dir = opendir(path)
  let next = readdir(dir)
  assert(next)
  while (next) {
    const entry = readEntry(next)
    if (!(entry.name === '..' || entry.name === '.')) {
      const entry_path = `${path}/${entry.name}`
      if (entry.d_type === DT_DIR) {
        entries.push({ path, name: entry.name, isDirectory: true })
        if (options.recursive) readdir_sync(entry_path, entries, options)
      } else if (entry.d_type === DT_REG) {
        entries.push({ path, name: entry.name, isFile: true })
      } else if (entry.d_type === DT_CHR) {
        entries.push({ path, name: entry.name, isChar: true })
      } else if (entry.d_type === DT_BLK) {
        entries.push({ path, name: entry.name, isBlock: true })
      } else if (entry.d_type === DT_LNK) {
        const path_name = ptr(new Uint8Array(1024))
        const len = core.readlink(entry_path, path_name.ptr, 1024)
        entries.push({ path: entry_path, name: lo.latin1Decode(path_name.ptr, len), isLink: true })
      } else {
        console.error(`unknown file type ${entry.d_type} for ${entry_path}`)
      }
    }
    next = readdir(dir)
  }
  assert(closedir(dir) === 0)
  return entries
}

function readEntry (handle) {
  if (os === 'mac') {
    readMemory(u8.ptr, handle, 21)
    const d_ino = dir_view.getUint32(0, true)
    const d_reclen = dir_view.getUint16(16, true)
    const d_namelen = dir_view.getUint16(18, true)
    const d_type = u8[20]
    const name = utf8Decode(handle + 21, strnlen(handle + 21, d_namelen))
    return { d_ino, d_off: 0, d_reclen, d_type, name }
  } else {
    readMemory(u8.ptr, handle, 19)
    const d_ino = dir_view.getUint32(0, true)
    const d_off = dir_view.getUint32(8, true)
    const d_reclen = dir_view.getUint16(16, true)
    const d_type = u8[18]
    const name = utf8Decode(handle + 19, strnlen(handle + 19, NAME_MAX))
    return { d_ino, d_off, d_reclen, d_type, name }
  }
}

function isFile (path) {
  const fd = open(path, O_RDONLY)
  if (fd <= 2) return false
  if (fstat(fd, stat.ptr) !== 0) return false
  close(fd)
  return checkMode(stat32[MODE_WORD], S_IFREG)
}

function isDir (path) {
  if (access(path, F_OK) !== 0) return false
  const fd = open(path, O_RDONLY)
  if (fd < 1) return false
  const r = fstat(fd, stat.ptr)
  if (r < 0) return false
  close(fd)
  return checkMode(stat32[MODE_WORD], S_IFDIR)
}

// todo: make these safe

function mkDirAll (full_path, fileMode = S_IRWXU | S_IRWXG | S_IROTH) {
  const subdirs = full_path.split('/').filter(dir => dir)
  let path = ''
  for (const dir of subdirs) {
    path = `${path}${dir}/`
    // todo: need a better api where this is not default
    if (isDir(path)) rmDirAll(path)
    if (mkdir(path, fileMode) !== 0) {
      throw new Error(`could not make directory ${path}: errno ${lo.errno}`)
    }
  }
}

// todo: make these safe and write comprehensive tests
function mkDirAllSafe (full_path, fileMode = S_IRWXU | S_IRWXG | S_IROTH) {
  const subdirs = full_path.split('/').filter(dir => dir)
  let path = full_path[0] === '/' ? '/' : ''
  for (const dir of subdirs) {
    path = `${path}${dir}/`
    if (!isDir(path)) {
      if (mkdir(path, fileMode) !== 0) {
        throw new Error(`could not make directory ${path}: errno ${lo.errno}`)
      }
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
        assert(unlink(entry_path) === 0, `error ${lo.errno} unlink ${entry_path}`)
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

// todo: snake-case - remove the old ones when we have converted
const is_dir = isDir
const is_file = isFile
const mkdir_all = mkDirAll
const rmdir_all = rmDirAll
const mkdir_all_safe = mkDirAllSafe
const read_entry = readEntry

export {
  mkDirAll, rmDirAll, isFile, isDir, readEntry,
  write_flags, read_flags, write_mode, dir_flags,
  is_dir, is_file, mkdir_all, rmdir_all, mkdir_all_safe, file_size, 
  readdir_sync, read_entry, file_size_fd, file_mode_fd, file_stat
}
