Bun.serve({
  fetch () {
    return new Response('Hello, World!') 
  },
  port: 3000
})
