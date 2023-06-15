const text = (new Array(1024 * 1024)).fill('A').join('')

var counter = 0;

Bun.serve({
  async fetch(req) {
    if ((counter++ + 1) % 1000 === 0)
      console.log(
        Math.round(text.length / (1024 * 1024)),
        "MB x",
        counter,
        "requests"
      );
    return new Response(text);
  },
  port: 3000
});
