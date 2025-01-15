const inflate_lib = lo.load('inflate')

const { assert, ptr } = lo

const DEFLATE = 8
const OS_UNIX = 3

function header (buf) {
  const [ id1, id2, cm, flg, , , , , xfl, os ] = buf.subarray(0, 10)
  assert(id1 === 0x1f && id2 === 0x8b, 'gzip magic incorrect')
  assert(cm === DEFLATE, 'not a gzip deflate archive')
  //assert(os === OS_UNIX, 'not a unix os archive')
  const header_view = new DataView(buf.buffer, buf.length - 8, 8)
  const size = header_view.getUint32(4, true)
  const FTEXT = (flg >> 7) & 0x01
  const FHCRC = (flg >> 6) & 0x01
  const FEXTRA = (flg >> 5) & 0x01
  const FNAME = (flg >> 4) & 0x01
  const FCOMMENT = (flg >> 3) & 0x01
  return { 
    id1, id2, cm, flg, xfl, os, FTEXT, FHCRC, FEXTRA, FNAME, FCOMMENT, size
  }
}

// todo: pass in destination buffer - do not allocate
function inflate (buf) {
  const { size } = header(buf)
  const dest = new Uint8Array(size)
  const bytes = inflate_lib.inflate.inflate(buf, buf.length, dest, dest.length)
  assert(bytes === size, `extracted size ${bytes} does not match expected ${size}`)
  return dest
}

function inflate2 (buf) {
  const { size } = header(buf)
  if (!buf.ptr) ptr(buf)
  const dest = ptr(new Uint8Array(size))
  const bytes = inflate_lib.inflate.inflate2(buf.ptr, buf.length, dest.ptr, dest.length)
  assert(bytes === size, `extracted size ${bytes} does not match expected ${size}`)
  return dest
}

export { inflate, inflate2, header }
