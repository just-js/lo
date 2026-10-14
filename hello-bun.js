import { Stats } from './lib/bench.js'

const stats = new Stats()
const HELLO = 'Hello, World!'

// routes as in Http11Probe's reference servers (src/Servers/BunServer):
// /echo, /cookie, POST echoes its body, anything else gets the hello text.
// `routes` match the raw path natively, so no request builds req.url
Bun.serve({
  routes: {
    '/echo': req => {
      stats.rps++
      let body = ''
      for (const [name, value] of req.headers) body += `${name}: ${value}\n`
      return new Response(body)
    },
    '/cookie': req => {
      stats.rps++
      let body = ''
      for (const pair of (req.headers.get('cookie') || '').split(';')) {
        const trimmed = pair.trimStart()
        const eq = trimmed.indexOf('=')
        if (eq > 0) body += `${trimmed.slice(0, eq)}=${trimmed.slice(eq + 1)}\n`
      }
      return new Response(body)
    }
  },
  fetch (req) {
    stats.rps++
    if (req.method === 'POST') return req.text().then(body => new Response(body))
    return new Response(HELLO)
  },
  port: parseInt(process.env.PORT || '3000', 10),
  reusePort: true
})

setInterval(() => stats.log(), 1000)
