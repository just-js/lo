import { mkDirAll, rmDirAll } from 'lib/fs.js'

const { utf8Decode, ptr, assert } = lo
const { write, close, mkdir, open, O_TRUNC, O_CREAT, O_WRONLY } = lo.core

// todo: refactor this
function getOctal (u8, off, len) {
  let i = 0
  while ((u8[off] < 48 || u8[off] > 55) && len > 0) {
    len--
    off++
  }
  while (u8[off] >= 48 && u8[off] <= 55 && len > 0) {
    i *= 8
    i += (u8[off] - 48)
    len--
    off++
  }
  return i
}

// there has to be a quicker way of doing this
function isLastBlock (u8, off) {
  for (let n = off + 511; n >= off; --n) if (u8[n] !== 0) return false
  return true
}

function verifyChecksum (u8, off) {
  // todo
/*
static int
verify_checksum(const char *p)
{
	int n, u = 0;
	for (n = 0; n < 512; ++n) {
		if (n < 148 || n > 155)
			u += ((unsigned char *)p)[n];
		else
			u += 0x20;

	}
	return (u == parseoct(p + 148, 8));
}
*/
  return true
}

// https://www.gnu.org/software/tar/manual/html_node/Dealing-with-Old-Files.html
function untar (u8, buf_size = u8.length) {
  let size = buf_size
  if (!u8.ptr) ptr(u8)
  let off = 0
  let topDir
  while (size) {
    if (size < 512) throw new Error(`Bad Size ${size}`)
    if (isLastBlock(u8, off)) {
      off += 512
      size -= 512
      continue
    }
    if (!verifyChecksum(u8, off)) throw new Error('Checksum failed')
    // todo - support filenames of 101-255 size
    let fileName = utf8Decode(u8.ptr + off, -1)
    const prefix = utf8Decode(u8.ptr + off + 345, -1)
    let fileSize = getOctal(u8, off + 124, 12)
    const fileType = u8[off + 156] - 48
    const fileMode = getOctal(u8, off + 100, 8)
    let fd = 0
    if (fileType === 5) {
      if (prefix.length) fileName = `${prefix}/${fileName}`
      if (!topDir) {
        topDir = fileName
        mkDirAll(fileName, fileMode)
      } else {
        const r = mkdir(fileName, fileMode)
        if (r !== 0) throw new Error(`could not make directory ${fileName}: errno ${lo.errno}`)
      }
    } else if ((fileType < 1 || fileType > 6) && fileType !== 55) {
      if (prefix.length) fileName = `${prefix}/${fileName}`
      if (topDir && fileName.indexOf(topDir) !== 0) throw new Error('Attempt to create file outside of top level Directory')
      // todo: fix this
      fd = open(fileName, O_TRUNC | O_CREAT | O_WRONLY, fileMode)
      if (fd <= 2) throw new Error(`could not create file ${fileName} with mode ${fileMode}: errno ${lo.errno}`)
    }
    let todo = fileSize
    let file_start = off + 512
    let file_size = 0
    while (todo > 0) {
      off += 512
      size -= 512
      if (size <= 0) throw new Error(`Bad Size: ${size} for ${fileName}`)
      let bytes = 512
      if (todo < 512) bytes = todo
      if (fd) {
        file_size += bytes
      }
      todo -= bytes
      if (fd && todo === 0) {
        const written = write(fd, u8.subarray(file_start, file_start + file_size), file_size)
        if (written !== file_size) throw new Error(`Write Failed: errno ${lo.errno}, written ${written} bytes ${file_size}`)
        close(fd)
        fd = 0
      }
    }
    size -= 512
    off += 512
  }
  assert(off === buf_size)
}

export { untar }
