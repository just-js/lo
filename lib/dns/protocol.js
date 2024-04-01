const opcode = {
  QUERY: 0,
  IQUERY: 1,
  STATUS: 2
}

const qtype = {
  A: 1,
  NS: 2,
  MD: 3,
  MF: 4,
  CNAME: 5,
  SOA: 6,
  MB: 7,
  MG: 8,
  MR: 9,
  NULL: 10,
  WKS: 11,
  PTR: 12,
  HINFO: 13,
  MINFO: 14,
  MX: 15,
  TXT: 16,
  // Additional
  AXFR: 252,
  MAILB: 253,
  MAILA: 254,
  ANY: 255
}

const qclass = {
  IN: 1,
  CS: 2,
  CH: 3,
  HS: 4,
  ANY: 255
}

const rcode = {
  NOERROR: 0,
  FORMAT: 1,
  SERVER: 2,
  NAME: 3,
  NOTIMPL: 4,
  REFUSED: 5
}

const types = { opcode, qtype, qclass, rcode }

const decoder = new TextDecoder()
const encoder = new TextEncoder()

function readName (offset, buf) {
  let name = []
  let qnameSize = buf[offset++]
  while (qnameSize) {
    if ((qnameSize & 192) === 192) {
      let off = (qnameSize - 192) << 8
      off += buf[offset++]
      name = name.concat(readName(off, buf))
      qnameSize = 0
    } else {
      name.push(decoder.decode(buf.subarray(offset, offset + qnameSize)))
      offset += qnameSize
      qnameSize = buf[offset++]
    }
  }
  return name
}

const parse = (buf, len) => {
  const view = new DataView(buf.buffer)
  const id = view.getUint16(0)
  const flags = view.getUint16(2)
  const QR = (flags >> 15) & 0b1
  const opCode = (flags >> 11) & 0b1111
  const AA = (flags >> 10) & 0b1
  const TC = (flags >> 9) & 0b1
  const RD = (flags >> 8) & 0b1
  const RA = (flags >> 7) & 0b1
  const Z = (flags >> 4) & 0b111
  const RCODE = flags & 0b1111
  const qcount = view.getUint16(4)
  const ancount = view.getUint16(6)
  const nscount = view.getUint16(8)
  const arcount = view.getUint16(10)
  const question = []
  const answer = []
  const authority = []
  const additional = []
  const start = 12
  let off = start
  let i = off
  let counter = qcount
  while (counter--) {
    let size = 0
    const sections = []
    while (buf[i++]) size++
    if (size > 0) {
      while (off - start < size) {
        const qnameSize = view.getUint8(off++)
        sections.push(decoder.decode(buf.subarray(off, off + qnameSize)))
        off += qnameSize
      }
    }
    off++
    const qtype = view.getUint16(off)
    off += 2
    const qclass = view.getUint16(off)
    off += 2
    question.push({ qtype, qclass, name: sections })
  }
  counter = ancount
  while (counter--) {
    const next = view.getUint16(off)
    let name
    if ((0b1100000000000000 & next) === 0b1100000000000000) {
      name = readName(next & 0b11111111111111, buf)
      off += 2
    } else {
      name = readName(off, buf)
      off += name.length + (name.reduce((a, v) => a + v.length, 0)) + 1
    }
    const qtype = view.getUint16(off)
    off += 2
    const qclass = view.getUint16(off)
    off += 2
    const ttl = view.getUint32(off)
    off += 4
    const rdLength = view.getUint16(off)
    off += 2
    if (qtype === 5) {
      const cname = readName(off, buf)
      answer.push({ name, cname, qtype, qclass, ttl })
    } else if (qtype === 1) {
      answer.push({ name, qtype, qclass, ttl, ip: buf.slice(off, off + rdLength) })
    }
    off += rdLength
  }
  return { bytes: buf.slice(0, len), qcount, nscount, ancount, arcount, id, flags, QR, opCode, AA, TC, RD, RA, Z, RCODE, question, answer, authority, additional }
}

const create = (domain, buf, id, qtype = 1, qclass = 1) => {
  const view = new DataView(buf.buffer)
  view.setUint16(0, id)
  view.setUint16(2, 0b0000000101000000)
  view.setUint16(4, 1)
  view.setUint16(6, 0)
  view.setUint16(8, 0)
  view.setUint16(10, 0)
  let off = 12
  const parts = domain.split('.')
  for (const part of parts) {
    view.setUint8(off++, part.length)
    encoder.encodeInto(part, buf.subarray(off))
    //buf.writeString(part, off)
    off += part.length
  }
  buf[off++] = 0
  view.setUint16(off, qtype)
  off += 2
  view.setUint16(off, qclass)
  off += 2
  return off
}

const qtypes = {}
Object.keys(types.qtype).forEach(k => {
  qtypes[types.qtype[k]] = k
})
const qclasses = {}
Object.keys(types.qclass).forEach(k => {
  qclasses[types.qclass[k]] = k
})
const opcodes = {}
Object.keys(types.opcode).forEach(k => {
  opcodes[types.opcode[k]] = k
})
const rcodes = {}
Object.keys(types.rcode).forEach(k => {
  rcodes[types.rcode[k]] = k
})

function get_flags (message) {
  const flags = []
  if (message.QR) flags.push('qr')
  if (message.AA) flags.push('aa')
  if (message.TC) flags.push('tc')
  if (message.RD) flags.push('rd')
  if (message.RA) flags.push('ra')
  if (message.Z) flags.push('z')
  return flags.join(' ')
}

export { get_flags, create, parse, types, qtypes, qclasses, opcodes, rcodes }
