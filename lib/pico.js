const { pico } = spin.load('pico')

function http_state (context_size = 32, max_header_size = 1024, max_headers = 64) {
  const sbuf = new Uint8Array(context_size + (max_header_size * max_headers))
  return new Uint32Array(sbuf.buffer)
}

export { pico, http_state }
