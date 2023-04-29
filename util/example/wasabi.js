import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { join, extName } from 'lib/path.js'
import { isFile, fs } from 'lib/fs.js'
import { Timer } from 'lib/timer.js'
import { pico } from 'lib/pico.js'

const { O_RDONLY } = fs.constants
const { assert, args } = spin
const {
  socket, setsockopt, bind, listen, close, accept4, send, recv, on
} = net
const { 
  SOCK_STREAM, AF_INET, SOCK_NONBLOCK, SOL_SOCKET, SO_REUSEPORT, 
  SOCKADDR_LEN, SOMAXCONN, O_NONBLOCK
} = net.constants
const { sockaddr_in } = net.types

class Request {
  method = ''
  path = ''
  headers = {}
  fd = 0
  minorVersion = 1

  constructor (state, u8, fd) {
    this.fd = fd
    const [path_len, , method_len, , , , minorVersion] = state
    const text = decoder.decode(u8)
    this.method = text.slice(0, method_len)
    this.path = text.slice(method_len + 1, method_len + 1 + path_len)
    const [, ...headers] = text.split('\r\n').slice(0, -2)
    this.headers = {}
    this.minorVersion = minorVersion
    for (const header of headers) {
      const [name, value] = header.split(': ')
      this.headers[name] = value
    }
  }
}

class Response {
  fd = 0
  status = 200
  statusMessage = 'OK'
  request = null

  constructor (req) {
    this.request = req
    this.fd = req.fd
  }

  async text (text, contentType = responses.txt) {
    const { status, fd } = this
    const payload = encoder.encode(text)
    const headers = encoder.encode(`${contentType[status]}${payload.byteLength}${END}`)
    send(fd, headers, headers.length, 0)
    send(fd, payload, payload.length, 0)
  }

  async sendFile (fileName) {
    // todo: check fileName is valid/safe
    const fd = fs.open(fileName, O_RDONLY)
    if (fd < 3) {
      this.status = 404
      this.text('Not Found')
      return
    }
    assert(fs.fstat(fd, stat) === 0)
    const ext = extName(fileName)
    const contentType = responses[ext] || responses.default
    const size = Number(stat32[12])
    const range = this.request.headers['Range']
    if (range) {
      let [start, end] = range.split('=')[1].split('-').map(v => parseInt(v || 0, 10))
      if (end === 0) {
        end = start + chunkSize
      } else {
        end += 1
      }
      if (end > size) end = size
      this.status = 206
      const headers = encoder.encode(`${contentType[this.status]}${end - start}\r\nContent-Range: bytes ${start}-${end - 1}/${size}\r\nCache-Control: max-age=${cacheMaxAge}${END}`)
      // todo: wait for writable if we fill the tcp buffers
      assert(send(this.fd, headers, headers.length, 0) === headers.length)
      const buf = new Uint8Array(end - start)
      assert(fs.lseek(fd, start, SEEK_SET) === start)
      const len = fs.read(fd, buf, end - start)
      assert(len === end - start)

      let done = 0
      while (done < len) {
        const written = send(this.fd, done === 0 ? buf : buf.subarray(done, len), len - done, 0)
        if (written < (len - done)) {
          if (written === -1) {
            if (spin.errno === 11) {
              await writable(this.fd)
            } else {
              close(fd)
              console.log('ass')
              throw new Error('foo')
            }
          } else {
            done += written
            await writable(this.fd)
          }
        } else {
          done += written
        }
      }


      //const written = send(this.fd, buf, len, 0)
      assert(done === len)
      assert(close(fd) === 0)
      return
    }
    const headers = encoder.encode(`${contentType[this.status]}${size}${END}`)
    send(this.fd, headers, headers.length, 0)
    const buf = new Uint8Array(size)
    let off = 0
    let len = fs.read(fd, buf, size)
    while (len > 0) {
      let done = 0
      while (done < len) {
        const written = send(this.fd, done === 0 ? buf : buf.subarray(done, len), len - done, 0)
        if (written < (len - done)) {
          if (written === -1) {
            if (spin.errno === 11) {
              await writable(this.fd)
            } else {
              close(fd)
              throw new Error('foo')
            }
          } else {
            done += written
            await writable(this.fd)
          }
        } else {
          done += written
        }
      }
      off += len
      if (off === size) break
      len = fs.read(fd, buf, size)
    }
    assert(fs.close(fd) === 0)
  }

  async sendFileHeaders (fileName) {
    const fd = fs.open(fileName, O_RDONLY)
    if (fd < 3) {
      this.status = 404
      this.text('Not Found')
      return
    }
    assert(fs.fstat(fd, stat) === 0)
    const ext = extName(fileName)
    const contentType = responses[ext] || responses.default
    const size = Number(stat32[12])
    const range = this.request.headers['Range']
    if (range) {
      let [start, end] = range.split('=')[1].split('-').map(v => parseInt(v || 0, 10))
      if (end === 0) {
        end = start + chunkSize
      } else {
        end += 1
      }
      if (end > size) end = size
      this.status = 206
      const headers = encoder.encode(`${contentType[this.status]}${end - start}\r\nContent-Range: bytes ${start}-${end - 1}/${size}\r\nCache-Control: max-age=${cacheMaxAge}${END}`)
      // todo: wait for writable if we fill the tcp buffers
      assert(send(this.fd, headers, headers.length, 0) === headers.length)
      return
    }
    const headers = encoder.encode(`${contentType[this.status]}${size}${END}`)
    send(this.fd, headers, headers.length, 0)
    assert(fs.close(fd) === 0)
  }
}

function serve (req) {
  let { path } = req
  if (path === '/' || path === '') path = '/index.html'
  const { method } = req
  const res = new Response(req)
  if (method !== 'GET' && method !== 'HEAD') {
    res.status = 400
    return res.text('')
  }
  const match = path.match(/\/play\/(.+)/)
  if (match && match.length > 1) {
    const [ videoUrl ] = match.slice(1)
    if (method === 'HEAD') {
      return res.sendFileHeaders(`/${videoUrl}`)
    }
    return res.sendFile(`/${videoUrl}`)
  }
  const fileName = join(homeDir, path.slice(1))
  if (!isFile(fileName)) {
    res.status = 404
    return res.text('')
  }
  try {
    if (method === 'HEAD') {
      return res.sendFileHeaders(fileName)
    }
    return res.sendFile(fileName)
  } catch (err) {
    res.status = 500
    return res.text(err.stack)
  }
}

function writable (fd) {
  return new Promise(resolve => {
    eventLoop.modify(fd, Loop.Writable | Loop.EdgeTriggered, () => {
      eventLoop.modify(fd, Loop.Readable, onReadable)
      resolve()
    })
  })
}

function onReadable (fd) {
  // todo - handle requests across multiple chunks
  const bytes = recv(fd, u8, BUFSIZE, 0)
  if (bytes > 0 && pico.parseRequest(u8.subarray(0, bytes), bytes, state) === bytes) {
    serve(new Request(state, u8.subarray(0, bytes), fd)).catch(err => console.error(err.stack))
    return
  }
  if (bytes < 0 && spin.errno === Loop.Blocked) return
  if (bytes < 0) console.error('socket_error')
  eventLoop.remove(fd)
  close(fd)
}

function onConnect (sfd) {
  const fd = accept4(sfd, 0, 0, O_NONBLOCK)
  if (fd > 0) {
    eventLoop.add(fd, onReadable)
    return
  }
  if (spin.errno === Loop.Blocked) return
  close(fd)
}

function createResponses (serverName) {
  const time = (new Date()).toUTCString()
  Object.keys(contentTypes).forEach(contentType => {
    Object.keys(statusMessages).forEach(status => {
      responses[contentType][status] = `HTTP/1.1 ${status} ${statusMessages[status]}\r\nServer: ${serverName}\r\nContent-Type: ${contentTypes[contentType]}\r\nDate: ${time}\r\nContent-Length: `
    })
  })
}

const statusMessages = {
  200: 'OK', 201: 'Created', 204: 'OK', 206: 'Partial Content',
  101: 'Switching Protocols', 302: 'Redirect', 400: 'Bad Request',
  401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 429: 'Server Busy',
  500: 'Server Error'
}

const contentTypes = {
  text: 'text/plain', css: 'text/css', txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8', html: 'text/html; charset=utf-8',
  ico: 'application/favicon', png: 'application/png',
  xml: 'application/xml; charset=utf-8',
  js: 'application/javascript; charset=utf-8', wasm: 'application/wasm',
  default: 'application/octet-stream',
}

const cacheMaxAge = 3600
const SEEK_SET = 0
const chunkSize = 16384
const HTTP_CTX_SZ = 32
const HTTP_HEADER_SZ = 32
const MAXHEADERS = 32
const BUFSIZE = 65536
const END = '\r\n\r\n'
const responses = {}
const stat = new Uint8Array(160)
const stat32 = new Uint32Array(stat.buffer)
const sbuf = new Uint8Array(HTTP_CTX_SZ + (HTTP_HEADER_SZ * MAXHEADERS))
const state = new Uint32Array(sbuf.buffer)
const u8 = new Uint8Array(BUFSIZE)
const decoder = new TextDecoder()
const encoder = new TextEncoder()
const [ homeDir = './' ] = args.slice(2)
const address = '0.0.0.0'
const port = 8080
const serverName = 'poo'
Object.keys(contentTypes).forEach(k => responses[k] = {})
createResponses(serverName)
const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
assert(fd !== -1)
assert(setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, on, 32) === 0)
assert(bind(fd, sockaddr_in(address, port), SOCKADDR_LEN) === 0)
assert(listen(fd, SOMAXCONN) === 0)
const eventLoop = new Loop()
assert(!eventLoop.add(fd, onConnect))
const timer = new Timer(eventLoop, 1000, () => createResponses(serverName))
while (1) {
  spin.runMicroTasks()
  if (eventLoop.poll(-1) <= 0) break
}
close(fd)
timer.close()
