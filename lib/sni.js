const SNI = 0
const ECPOINTSFMT = 11

const parsers = {
  [SNI]: (extension, u8, off) => {
    const listlen = (u8[off++] << 8) + u8[off++]
    const type = u8[off++]
    const namelen = (u8[off++] << 8) + u8[off++]
    extension.name = u8.slice(off, off + namelen)
  },
  [ECPOINTSFMT]: (extension, u8, off) => {
    const listlen = u8[off++]
    extension.formats = u8.slice(off, off + listlen)
  }
}

function parseExtensions (size, u8, off) {
  const extensions = {}
  let bytes = size
  while (bytes > 0) {
    const type = (u8[off++] << 8) + u8[off++]
    const size = (u8[off++] << 8) + u8[off++]
    const extension = {}
    parsers[type] && parsers[type](extension, u8, off)
    extensions[type] = extension
    bytes -= (size + 4)
    off += size
  }
  return extensions
}

function parseHello (u8) {
  const handshake = {
    protocol: u8[0],
    ssl: `${u8[1]}.${u8[2]}`,
    size: (u8[3] << 8) + u8[4]
  }
  const header = {
    type: u8[5],
    size: (u8[6] << 16) + (u8[7] << 8) + u8[8],
    version: `${u8[9]}.${u8[10]}`
  }
  const rand = u8.slice(11, 43)
  let size = u8[43]
  const session = u8.slice(44, 44 + size)
  size = (u8[76] << 8) + u8[77]
  const ciphers = []
  let off = 78
  for (let i = 0; i < size; i += 2) {
    ciphers.push((u8[off++] << 8) + u8[off++])
  }
  size = u8[off++]
  const compression = []
  for (let i = 0; i < size; i++) {
    compression.push(u8[off++])
  }
  const extensions = parseExtensions((u8[off++] << 8) + u8[off++], u8, off)
  return {
    handshake, header, rand, session, ciphers, compression, extensions
  }
}

export { parseHello }
