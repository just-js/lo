import http from 'node:http'
import { Stats } from './lib/bench.js'

const stats = new Stats()
const HELLO = 'Hello, World!'
// same 3 response headers as hello-lo.js and hello-bun.js (content-type,
// Date, Content-Length): removeHeader('connection') stops Node adding its
// own Connection/Keep-Alive headers; HTTP/1.1 stays persistent without them
const HEADERS = { 'content-type': 'text/plain;charset=utf-8' }

function reply (res, body) {
  res.removeHeader('connection')
  res.writeHead(200, { ...HEADERS, 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

// routes as in Http11Probe's reference servers (src/Servers/NodeServer):
// /echo, /cookie, POST echoes its body, anything else gets the hello text.
// the path is req.url up to '?' (no new URL() per request)
const server = http.createServer((req, res) => {
  stats.rps++
  const q = req.url.indexOf('?')
  const path = q === -1 ? req.url : req.url.slice(0, q)
  if (path === '/echo') {
    let body = ''
    const raw = req.rawHeaders
    for (let i = 0; i < raw.length; i += 2) body += `${raw[i]}: ${raw[i + 1]}\n`
    return reply(res, body)
  }
  if (path === '/cookie') {
    let body = ''
    for (const pair of (req.headers.cookie || '').split(';')) {
      const trimmed = pair.trimStart()
      const eq = trimmed.indexOf('=')
      if (eq > 0) body += `${trimmed.slice(0, eq)}=${trimmed.slice(eq + 1)}\n`
    }
    return reply(res, body)
  }
  if (req.method === 'POST') {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => reply(res, Buffer.concat(chunks)))
    return
  }
  reply(res, HELLO)
})

server.listen(parseInt(process.env.PORT || '3000', 10), '127.0.0.1')
setInterval(() => stats.log(), 1000)
