import { constants } from 'lib/pg/common.js'
import { createParser } from 'lib/pg/parser.js'
import { Digest } from 'lib/hash.js'
import { encode } from 'lib/encode.js'

const hasher = new Digest('md5')

const { ptr, utf8Decode } = lo

function md5 (str) {
  const digest = hasher.hashString(str)
  const hex_encoded = ptr(new Uint8Array(digest.length * 2))
  const size = encode.hex_encode(digest, digest.length, hex_encoded, hex_encoded.length)
  return utf8Decode(hex_encoded.ptr, size)
}

function md5b (buf) {
  const digest = hasher.hash(buf)
  const hex_encoded = ptr(new Uint8Array(digest.length * 2))
  const size = encode.hex_encode(digest, digest.length, hex_encoded, hex_encoded.length)
  return utf8Decode(hex_encoded.ptr, size)
}

const { messageFields } = constants
const { INT4OID, VARCHAROID } = constants.fieldTypes

class NameIndex {
  constructor () {
    this.index = 0
    this.vals = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-+'
  }

  getId (name) {
    const { vals, index } = this
    if (index >= vals.length) return name
    const id = vals.charCodeAt(index)
    this.index++
    return id
  }
}

const nameIndexer = new NameIndex()

class Protocol {
  constructor (buffer, config) {
    this.buffer = buffer
    this.view = new DataView(buffer)
    this.bytes = new Uint8Array(buffer)
    this.len = buffer.byteLength
    this.params = config.params
    this.config = config
    this.id = nameIndexer.getId(config.name)
  }

  startup (off = 0) {
    const { view, buffer, config } = this
    const { user, database, version, parameters = [] } = config
    view.setInt32(0, 0)
    off += 4
    view.setInt32(4, version) // protocol version
    off += 4
    off += buffer.writeString('user', off)
    view.setUint8(off++, 0)
    off += buffer.writeString(user, off)
    view.setUint8(off++, 0)
    off += buffer.writeString('database', off)
    view.setUint8(off++, 0)
    off += buffer.writeString(database, off)
    view.setUint8(off++, 0)
    for (let i = 0; i < parameters.length; i++) {
      const { name, value } = parameters[i]
      off += buffer.writeString(name, off)
      view.setUint8(off++, 0)
      off += buffer.writeString(value, off)
      view.setUint8(off++, 0)
    }
    view.setUint8(off++, 0)
    view.setInt32(0, off)
    return off
  }

  md5auth (off = 0) {
    const { view, buffer, config } = this
    const { user, pass, salt } = config
    const token = `${pass}${user}`
    let hash = md5(token)

    const plain = new ArrayBuffer(36)
    plain.writeString(`md5${hash}`, 0)
    const plain2 = new ArrayBuffer(36)
    plain2.copyFrom(plain, 0, 32, 3)
    plain2.copyFrom(salt, 32, 4)
    hash = `md5${md5(plain2)}`
    const len = hash.length + 5

    view.setUint8(off++, 112)
    view.setUint32(off, len)
    off += 4
    off += buffer.writeString(hash, off)
    view.setUint8(off++, 0)
    return off
  }

  parse (off = 0) {
    const { view, buffer, config, id, bytes } = this
    const { formats, sql } = config
    const flen = formats.length
    const len = 9 + String.byteLength(sql) + 1 + (flen * 4)
    view.setUint8(off++, 80) // 'P'
    view.setUint32(off, len - 1)
    off += 4
    bytes[off++] = id
    view.setUint8(off++, 0)
    off += buffer.writeString(sql, off)
    view.setUint8(off++, 0)
    view.setUint16(off, flen)
    off += 2
    for (let i = 0; i < flen; i++) {
      view.setUint32(off, formats[i].oid)
      off += 4
    }
    return off
  }

  describe (off = 0) {
    const { view, id, bytes } = this
    const len = 8
    view.setUint8(off++, 68) // 'D'
    view.setUint32(off, len - 1)
    off += 4
    view.setUint8(off++, 83) // 'S'
    bytes[off++] = id
    view.setUint8(off++, 0)
    return off
  }

  bind (off = 0) {
    const { view, buffer, config, params, bytes, id } = this
    const { formats, portal, fields } = config
    const start = off
    const flen = formats.length || 0
    const plen = params.length || 0
    const filen = fields.length
    view.setUint8(off++, 66) // 'B'
    off += 4 // length - will be filled in later
    if (portal.length) {
      off += buffer.writeString(portal, off)
    }
    view.setUint8(off++, 0)
    bytes[off++] = id
    view.setUint8(off++, 0)
    view.setUint16(off, flen)
    off += 2
    for (let i = 0; i < flen; i++) {
      view.setUint16(off, formats[i].format)
      off += 2
    }
    view.setUint16(off, plen)
    off += 2
    for (let i = 0; i < plen; i++) {
      const param = params[i]
      if ((formats[i] || formats[0]).format === 1) {
        view.setUint32(off, 4)
        off += 4
        view.setUint32(off, param)
        off += 4
      } else {
        view.setUint32(off, param.length)
        off += 4
        off += buffer.writeString(param, off)
      }
    }
    if (filen > 0) {
      const format = fields[0].format.format
      let same = true
      for (let i = 1; i < filen; i++) {
        if (fields[i].format.format !== format) {
          same = false
          break
        }
      }
      if (same) {
        view.setUint16(off, 1)
        off += 2
        view.setUint16(off, fields[0].format.format)
        off += 2
      } else {
        view.setUint16(off, filen)
        off += 2
        for (let i = 0; i < filen; i++) {
          view.setUint16(off, fields[i].format.format)
          off += 2
        }
      }
    } else {
      view.setUint16(off, 0)
      off += 2
    }
    view.setUint32(start + 1, (off - start) - 1)
    return off
  }

  exec (off = 0) {
    const { view, buffer, config } = this
    const { portal, maxRows } = config
    const len = 6 + portal.length + 4
    view.setUint8(off++, 69) // 'E'
    view.setUint32(off, len - 1)
    off += 4
    if (portal.length) off += buffer.writeString(portal, off)
    view.setUint8(off++, 0)
    view.setUint32(off, maxRows)
    off += 4
    return off
  }

  flush (off = 0) {
    const { view } = this
    view.setUint8(off++, 72) // 'H'
    view.setUint32(off, 4)
    off += 4
    return off
  }

  sync (off = 0) {
    const { view } = this
    view.setUint8(off++, 83) // 'S'
    view.setUint32(off, 4)
    off += 4
    return off
  }
}

class PGError extends Error {
  constructor (errors) {
    const err = {}
    errors.forEach(e => {
      const name = messageFields[e.type]
      if (!name) return
      err[name] = e.val
    })
    super(err.message)
    Object.assign(this, err)
    this.name = 'PGError'
  }
}

function createError (errors) {
  return new PGError(errors)
}

class Query {
  constructor (query, sock) {
    this.query = query
    this.buffer = sock.buffer
    this.parser = sock.parser
    this.htmlEscape = html.escape
    this.protocol = new Protocol(this.buffer, query)
  }

  generate () {
    const { query } = this
    const { fields } = query
    const source = []
    source.push('  const { parser, htmlEscape } = this')
    source.push('  const { state, dv, buf, u8 } = parser')
    source.push('  const { start, rows } = state')
    source.push('  let off = start + 7')
    source.push('  let len = 0')
    source.push('  if (rows === 1) {')
    for (const field of fields) {
      const { name, format } = field
      if (format.oid === INT4OID) {
        if (format.format === constants.formats.Binary) {
          source.push(`    const ${name} = dv.getInt32(off + 4)`)
          source.push('    off += 8')
        } else {
          source.push('    len = dv.getUint32(off)')
          source.push('    off += 4')
          source.push(`    const ${name} = parseInt(buf.readString(len, off), 10)`)
          source.push('    off += len')
        }
      } else if (format.oid === VARCHAROID) {
        source.push('    len = dv.getUint32(off)')
        source.push('    off += 4')
        if (format.format === constants.formats.Binary) {
          source.push(`    const ${name} = buf.slice(off, off + len)`)
        } else {
          source.push(`    const ${name} = buf.readString(len, off)`)
        }
        source.push('    off += len')
      }
    }
    source.push(`    return { ${fields.map(f => f.name).join(', ')} }`)
    source.push('  }')
    source.push('  const result = []')
    source.push('  off = start + 7')
    source.push('  for (let i = 0; i < rows; i++) {')
    for (const field of fields) {
      const { name, format } = field
      if (format.oid === INT4OID) {
        if (format.format === constants.formats.Binary) {
          source.push(`    const ${name} = dv.getInt32(off + 4)`)
          source.push('    off += 8')
        } else {
          source.push('    len = dv.getInt32(off)')
          source.push('    off += 4')
          source.push(`    const ${name} = parseInt(buf.readString(len, off), 10)`)
          source.push('    off += len')
        }
      } else if (format.oid === VARCHAROID) {
        source.push('    len = dv.getInt32(off)')
        source.push('    off += 4')
        if (format.format === constants.formats.Binary) {
          source.push(`    const ${name} = buf.slice(len, off)`)
        } else {
          if (field.htmlEscape) {
            source.push(`    const ${name} = htmlEscape(buf, len, off)`)
          } else {
            source.push(`    const ${name} = buf.readString(len, off)`)
          }
        }
        source.push('    off += len')
      }
    }
    source.push('    if (u8[off] === 84) {')
    source.push('      len = dv.getUint32(off + 1)')
    source.push('      off += len')
    source.push('    }')
    source.push(`    result.push({ ${fields.map(f => f.name).join(', ')} })`)
    source.push('    off += 7')
    source.push('  }')
    source.push('  return result')
    const read = source.join('\n').trim()
    if (read.length) this.read = new Function(read)
    return this
  }
}

class RingBuffer {
  constructor () {
    this.rb = new Array(65536)
    this.head = new Uint16Array(1)
    this.tail = new Uint16Array(1)
    this.length = 0
  }

  at (index) {
    return this.rb[this.head[0] + index]
  }

  push (fn) {
    if (this.length === 65536) this.shift()
    this.rb[this.tail[0]++] = fn
    this.length++
  }

  shift () {
    this.length--
    return this.rb[this.head[0]++]
  }
}

class PGCommand {
  constructor (query, resolve, reject, args = [], type = 'exec') {
    this.query = query
    this.type = type
    this.resolve = resolve
    this.reject = reject
    this.args = args
  }
}

const commandCache = new RingBuffer()

function getCommand (query, resolve, reject, args) {
  if (commandCache.length) {
    const cmd = commandCache.shift()
    cmd.query = query
    cmd.resolve = resolve
    cmd.reject = reject
    cmd.args = args
    return cmd
  }
  return new PGCommand(query, resolve, reject, args)
}

class PGSocket {
  constructor (sock, db) {
    this.sock = sock
    this.db = db
    this.off = 0
    sock.edgeTriggered = false
    const parser = this.parser = createParser(sock.buffer)
    const pending = this.pending = new RingBuffer()
    this.buffer = new ArrayBuffer(64 * 1024)
    this.protocol = new Protocol(this.buffer, db)
    this.len = this.buffer.byteLength
    this.flushing = false
    parser.onErrorResponse = () => {
      if (pending.length) {
        const cmd = pending.shift()
        cmd.reject(createError(parser.errors))
        commandCache.push(cmd)
      }
    }
    parser.onBackendKeyData = () => {
      const cmd = pending.shift()
      cmd.resolve()
      commandCache.push(cmd)
    }
    parser.onAuthenticationOk = () => {
      const cmd = pending.shift()
      cmd.resolve()
      commandCache.push(cmd)
    }
    parser.onParseComplete = () => {
      const cmd = pending.shift()
      const { query, resolve } = cmd
      resolve(this.wrap(query.generate()))
      commandCache.push(cmd)
    }
    parser.onCommandComplete = () => {
      const cmd = pending.shift()
      const { query, resolve } = cmd
      resolve(query.read())
      commandCache.push(cmd)
    }
  }

  compile (config) {
    const { pending } = this
    const query = new Query(config, this)
    const { protocol } = query
    return new Promise((resolve, reject) => {
      this.off = protocol.parse(this.off)
      this.off = protocol.describe(this.off)
      this.off = protocol.flush(this.off)
      pending.push(getCommand(query, resolve, reject, []))
      this.flush()
    })
  }

  flush () {
    if (this.flushing || this.off === 0) return 0
    const { sock, off } = this
    this.flushing = true
    const written = sock.send(this.buffer, this.off, 0)
    if (written === off) {
      this.off = 0
      this.flushing = false
      return written
    }
    if (written === 0) {
      this.flushing = false
      sock.close()
      return -1
    }
    if (written < off || (written < 0 && sock.blocked)) {
      if (written > 0) {
        this.buffer.copyFrom(this.buffer, 0, off - written, written)
        this.off = off - written
      }
      sock.onWritable = () => {
        sock.resume()
        this.flushing = false
        this.flush()
      }
      sock.pause()
      return 0
    }
    this.flushing = false
    sock.close()
    return -2
  }

  wrap (query) {
    const { pending } = this
    const { protocol } = query
    return (...args) => new Promise((resolve, reject) => {
      if (!pending.length) {
        protocol.params = args
        const cmd = getCommand(query, resolve, reject, args)
        pending.push(cmd)
        this.off = protocol.sync(protocol.exec(protocol.bind(this.off)))
        this.flush()
        return
      }
      protocol.params = args
      const cmd = getCommand(query, resolve, reject, args)
      this.off = protocol.sync(protocol.exec(protocol.bind(this.off)))
      pending.push(cmd)
    })
  }

  login () {
    const { db, parser, pending, protocol } = this
    return new Promise((resolve, reject) => {
      db.salt = parser.salt
      this.off = protocol.md5auth(this.off)
      pending.push(getCommand({}, resolve, reject))
      this.flush()
    })
  }

  start () {
    const { sock, parser, pending, protocol } = this
    sock.onReadable = () => {
      this.flush()
      const bytes = sock.recv(sock.buffer.offset)
      if (bytes > 0) return parser.parse(bytes)
      if (bytes === 0 || !sock.blocked) sock.close()
    }
    return new Promise((resolve, reject) => {
      this.off = protocol.startup(this.off)
      pending.push(getCommand({}, resolve, reject))
      sock.resume()
      this.flush()
    })
  }

  stop () {
    const { sock } = this
    sock.pause()
    sock.onReadable = () => {}
  }

  close () {
    return this.sock.close()
  }
}

async function createSocket (sock, db) {
  const pgsocket = new PGSocket(sock, db)
  await pgsocket.start()
  await pgsocket.login()
  return pgsocket
}

function createRingBuffer () {
  return new RingBuffer()
}

export {
  constants,
  Protocol,
  PGError,
  PGCommand,
  RingBuffer,
  Query,
  createError,
  createParser,
  createSocket,
  createRingBuffer,
  md5,
  md5b
}
