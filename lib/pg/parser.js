import { readCString, constants } from 'lib/pg/common.js'
const { messageFields } = constants

class Parser {
  constructor (u8) {
    this.pos = 0
    this.header = true
    const { buffer } = u8
    this.buf = buffer
    buffer.offset = 0
    const dv = new DataView(buffer)
    this.dv = dv
    this.u8 = u8
    const fields = [{}]
    this.fields = fields
    this.parameters = {}
    this.type = 0
    this.len = 0
    const errors = []
    const notice = {}
    this.notice = notice
    this.errors = errors
    const state = { start: 0, end: 0, rows: 0, running: false }
    this.state = state
    this.nextRow = 0
    this.parseNext = 0
    this.byteLength = buffer.byteLength
    const { messageTypes } = constants
    const parser = this
    this.handlers = {
      [messageTypes.AuthenticationOk]: (len, off) => {
        // R = AuthenticationOk
        const method = dv.getInt32(off)
        off += 4
        if (method === constants.AuthenticationMD5Password) {
          parser.salt = u8.slice(off, off + 4)
          off += 4
          parser.onAuthenticationOk()
        }
        return off
      },
      [messageTypes.NotificationResponse]: (len, off) => {
        // A = NotificationResponse
        const notification = {}
        notification.pid = dv.getUint32(off)
        off += 4
        notification.channel = readCString(u8, off)
        off += notification.channel.length + 1
        notification.message = readCString(u8, off)
        off += notification.message.length + 1
        parser.notification = notification
        parser.onNotificationResponse()
        parser.notification = {}
        return off
      },
      [messageTypes.NoticeResponse]: (len, off) => {
        // N = NoticeResponse
        const notice = {}
        let fieldType = u8[off++]
        while (fieldType !== 0) {
          const val = readCString(u8, off)
          notice[messageFields[fieldType]] = val
          off += (val.length + 1)
          fieldType = u8[off++]
        }
        parser.notice = notice
        parser.onNoticeResponse()
        parser.notice = {}
        return off
      },
      [messageTypes.ErrorResponse]: (len, off) => {
        // E = ErrorResponse
        errors.length = 0
        let fieldType = u8[off++]
        while (fieldType !== 0) {
          const val = readCString(u8, off)
          errors.push({ type: fieldType, val })
          off += (val.length + 1)
          fieldType = u8[off++]
        }
        parser.onErrorResponse()
        return off
      },
      [messageTypes.RowDescription]: (len, off) => {
        // T = RowDescription
        const fieldCount = dv.getInt16(off)
        off += 2
        fields.length = 0
        for (let i = 0; i < fieldCount; i++) {
          const name = readCString(u8, off)
          off += name.length + 1
          const tid = dv.getInt32(off)
          off += 4
          const attrib = dv.getInt16(off)
          off += 2
          const oid = dv.getInt32(off)
          off += 4
          const size = dv.getInt16(off)
          off += 2
          const mod = dv.getInt32(off)
          off += 4
          const format = dv.getInt16(off)
          off += 2
          fields.push({ name, tid, attrib, oid, size, mod, format })
        }
        parser.onRowDescription()
        return off
      },
      [messageTypes.CommandComplete]: (len, off) => {
        // C = CommandComplete
        state.end = off - 5
        state.rows = parser.nextRow
        state.running = false
        off += len - 4
        parser.nextRow = 0
        parser.onCommandComplete()
        return off
      },
      [messageTypes.CloseComplete]: (len, off) => {
        // 3 = CloseComplete
        parser.onCloseComplete()
        return off + len - 4
      },
      [messageTypes.ParseComplete]: (len, off) => {
        // 1 = ParseComplete
        off += len - 4
        parser.onParseComplete()
        return off
      },
      [messageTypes.BindComplete]: (len, off) => {
        // 2 = BindComplete
        off += len - 4
        parser.onBindComplete()
        state.rows = 0
        state.start = off
        state.running = true
        return off
      },
      [messageTypes.ReadyForQuery]: (len, off) => {
        // Z = ReadyForQuery
        parser.status = u8[off]
        parser.onReadyForQuery()
        off += len - 4
        return off
      },
      [messageTypes.BackendKeyData]: (len, off) => {
        // K = BackendKeyData
        parser.pid = dv.getUint32(off)
        off += 4
        parser.key = dv.getUint32(off)
        off += 4
        parser.onBackendKeyData()
        return off
      },
      [messageTypes.ParameterStatus]: (len, off) => {
        // S = ParameterStatus
        const key = readCString(u8, off)
        off += (key.length + 1)
        const val = readCString(u8, off)
        off += val.length + 1
        parser.parameters[key] = val
        return off
      },
      [messageTypes.ParameterDescription]: (len, off) => {
        // t = ParameterDescription
        const nparams = dv.getInt16(off)
        parser.params = []
        off += 2
        for (let i = 0; i < nparams; i++) {
          parser.params.push(dv.getUint32(off))
          off += 4
        }
        return off
      },
      [messageTypes.DataRow]: (len, off) => {
        // D = DataRow
        if (this.nextRow === 0) this.state.start = off - 5
        parser.nextRow++
        return off + len - 4
      },
      0: (len, off) => {
        off += len - 4
        return off
      }
    }
  }

  resetBuffer (off, remaining) {
    const { buf, state } = this
    const queryLen = off - state.start + remaining
    buf.copyFrom(buf, 0, queryLen, state.start)
    buf.offset = queryLen
    this.parseNext = off - state.start
    state.start = 0
  }

  checkAvailable (off, remaining, want) {
    const { buf, byteLength } = this
    if (remaining < want) {
      if (byteLength - off < 1024) {
        this.resetBuffer(off, remaining)
        return true
      }
      buf.offset = off + remaining
      this.parseNext = off
      return true
    }
    return false
  }

  parse (bytesRead) {
    const { buf, parseNext, dv, handlers } = this
    let type
    let len
    let off = parseNext
    const end = buf.offset + bytesRead
    while (off < end) {
      const remaining = end - off
      let want = 5
      if (this.checkAvailable(off, remaining, want)) return
      type = this.type = dv.getUint8(off)
      len = this.len = dv.getUint32(off + 1)
      want = len + 1
      if (this.checkAvailable(off, remaining, want)) return
      off += 5
      off = (handlers[type] || handlers[0])(len, off)
    }
    this.parseNext = buf.offset = 0
  }

  readStatus () {
    return readCString(this.u8, this.state.start + 5)
  }

  free () {
    const { state, fields, errors } = this
    fields.length = 0
    errors.length = 0
    this.parameters = {}
    this.nextRow = 0
    this.parseNext = 0
    state.start = state.end = state.rows = 0
    state.running = false
  }

  onAuthenticationOk () {}
  onNotificationResponse () {}
  onNoticeResponse () {}
  onErrorResponse () {}
  onRowDescription () {}
  onCommandComplete () {}
  onCloseComplete () {}
  onParseComplete () {}
  onBindComplete () {}
  onReadyForQuery () {}
  onBackendKeyData () {}
}

function createParser (buf) {
  return new Parser(buf)
}

export { createParser }
