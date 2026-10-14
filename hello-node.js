require('node:http')
  .createServer((req, res) => {
    //const { url, method, headers } = req
    //res.removeHeader('Connection')
    res.end('Hello, World')
  })
  .listen(parseInt(process.env.PORT || 3000, 10), '127.0.0.1', () => {})
