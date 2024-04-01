const { pico } = lo.load('pico')

const { ptr, addr, latin1Decode } = lo

const rx = /-/g

class ResponseParser {
  #minor_version = ptr(new Uint32Array(1))
  #status_code = ptr(new Uint32Array(1))
  #num_headers = ptr(new Uint32Array(1))
  #message = ptr(new Uint32Array(2))
  #message_len = ptr(new Uint32Array(1))
  #raw_headers = ptr(new Uint32Array(8 * 16))
  #decoder = ptr(new Uint8Array(pico.struct_phr_chunked_decoder_size))
  #chunk_size = ptr(new Uint32Array(2))
  rb = ptr(new Uint8Array(0))
  chunked_done = false

  constructor (rb, n_headers = 16) {
    this.rb = rb.ptr ? rb : ptr(rb)
    this.#num_headers[0] = n_headers
    // todo - refactor this
    if (n_headers !== 16) {
      this.#raw_headers = ptr(new Uint32Array(8 * n_headers))
    }
    // this should just be size, off, we know the ptr
    this.parse = (new Function('parse', 'ptr', 'size', `
    return function (len = size) {
      return parse(ptr, len, ${this.#minor_version.ptr}, 
        ${this.#status_code.ptr}, ${this.#message.ptr}, ${this.#message_len.ptr}, 
        ${this.#raw_headers.ptr}, ${this.#num_headers.ptr}, 0)
    }
    `))(pico.parse_response, rb.ptr, rb.size)
  }

  get status () {
    return this.#status_code[0]
  }

  get minor_version () {
    return this.#minor_version[0]
  }

  get message () {
    return latin1Decode(addr(this.#message), this.#message_len[0])
  }

  get num_headers () {
    return this.#num_headers[0]
  }

  reset () {
    this.#decoder.fill(0)
    this.chunked_done = false
  }

  get headers () {
    const nhead = this.#num_headers[0]
    const raw_headers = this.#raw_headers
    let n = 0
    const result = {}
    for (let i = 0; i < nhead; i++) {
      const key_address = addr(raw_headers.subarray(n, n + 2))
      const key_len = raw_headers[n + 2]
      const val_address = addr(raw_headers.subarray(n + 4, n + 6))
      const val_len = raw_headers[n + 6]
      const key_string = latin1Decode(key_address, key_len).toLowerCase().replace(rx, '_')
      const val_string = latin1Decode(val_address, val_len)
      result[key_string] = val_string
      n += 8
    }
    return result
  }

  read_chunk (off = 0, remaining = 0) {
    const { rb } = this
    const sz = this.#chunk_size
    sz[0] = remaining
    const rc = pico.decode_chunked(this.#decoder.ptr, rb.ptr + off, sz.ptr)
//    console.log(`decode_chunked ${rc} ${sz[0]}`)
    if (rc === -2 || rc > 0) {
      if (rc > 0) this.chunked_done = true
      return rb.subarray(off, off + sz[0])
    }
  }
}


class RequestParser {
  // todo: create one buffer and use offsets
  #method = ptr(new Uint32Array(2))
  #method_len = ptr(new Uint32Array(2))
  #path = ptr(new Uint32Array(2))
  #path_len = ptr(new Uint32Array(2))
  #minor_version = ptr(new Uint32Array(1))
  #raw_headers = ptr(new Uint32Array(8 * 16))
  #num_headers = ptr(new Uint32Array(2))
  #decoder = ptr(new Uint8Array(pico.struct_phr_chunked_decoder_size))
  #chunk_size = ptr(new Uint32Array(2))
  rb = ptr(new Uint8Array(0))

  constructor (rb, n_headers = 16) {
    this.rb = rb.ptr ? rb : ptr(rb)
    this.#num_headers[0] = n_headers
    if (n_headers !== 16) {
      this.#raw_headers = ptr(new Uint32Array(8 * n_headers))
    }
    this.parse = (new Function('parse', 'ptr', 'size', `
    return function (len = size) {
      return parse(ptr, len, ${this.#method.ptr}, 
        ${this.#method_len.ptr}, ${this.#path.ptr}, ${this.#path_len.ptr}, 
        ${this.#minor_version.ptr}, ${this.#raw_headers.ptr}, ${this.#num_headers.ptr}, 0)
    }
    `))(pico.parse_request, rb.ptr, rb.size)
  }

  get method () {
    // todo
    //return this.rb[addr(this.#method) - this.rb.ptr]
    const method_address = addr(this.#method)
    //console.log(method_address - this.rb.ptr)
    //console.log(this.rb[method_address - this.rb.ptr])
    return latin1Decode(method_address, this.#method_len[0])
  }

  get path () {
    const path_address = addr(this.#path)
    return latin1Decode(path_address, this.#path_len[0])
  }

  get minor_version () {
    return this.#minor_version[0]
  }

  get num_headers () {
    return this.#num_headers[0]
  }

  get headers () {
    const nhead = this.#num_headers[0]
    const raw_headers = this.#raw_headers
    let n = 0
    const result = {}
    for (let i = 0; i < nhead; i++) {
      const key_address = addr(raw_headers.subarray(n, n + 2))
      const key_len = raw_headers[n + 2]
      const val_address = addr(raw_headers.subarray(n + 4, n + 6))
      const val_len = raw_headers[n + 6]
      const key_string = latin1Decode(key_address, key_len).toLowerCase().replace(rx, '_')
      const val_string = latin1Decode(val_address, val_len)
      result[key_string] = val_string
      n += 8
    }
    return result
  }
}

function parse_url (url) {
  const protocolEnd = url.indexOf(':')
  const protocol = url.slice(0, protocolEnd)
  const hostnameEnd = url.indexOf('/', protocolEnd + 3)
  let hostname = url.slice(protocolEnd + 3, hostnameEnd)
  const path = url.slice(hostnameEnd)
  let port = 80
  if (protocol === 'https') port = 443
  if (hostname.indexOf(':') > -1) {
    const parts = hostname.split(':')
    hostname = parts[0]
    port = parseInt(parts[1], 10)
  }
  return { protocol, hostname, path, port }
}

export { RequestParser, ResponseParser, pico, parse_url }
