require('node:http')
  .createServer((req, res) => res.end('Hello, World'))
  .listen(3000, '127.0.0.1', () => {})
