const inflate_lib = lo.load('inflate')

const { assert } = lo

const DEFLATE = 8
const OS_UNIX = 3

function header (buf) {
  const [ id1, id2, cm, flg, , , , , xfl, os ] = buf.subarray(0, 10)
  assert(id1 === 0x1f && id2 === 0x8b, 'gzip magic incorrect')
  const FTEXT = (flg >> 7) & 0x01
  const FHCRC = (flg >> 6) & 0x01
  const FEXTRA = (flg >> 5) & 0x01
  const FNAME = (flg >> 4) & 0x01
  const FCOMMENT = (flg >> 3) & 0x01
  return { id1, id2, cm, flg, xfl, os, FTEXT, FHCRC, FEXTRA, FNAME, FCOMMENT }
}

function inflate (buf) {
  const [ id1, id2, cm, , , , , , , os ] = buf.subarray(0, 10)
  assert(id1 === 0x1f && id2 === 0x8b, 'gzip magic incorrect')
  assert(cm === DEFLATE, 'not a gzip deflate archive')
  assert(os === OS_UNIX, 'not a unix os archive')
  const header_view = new DataView(buf.buffer, buf.length - 8, 8)
  const original_size = header_view.getUint32(4, true)
  const dest = new Uint8Array(original_size)
  const bytes = inflate_lib.inflate.inflate(buf, buf.length, dest, dest.length)
  assert(bytes === original_size, 'extracted size does not match')
  return dest
}

export { inflate, header }
