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
  rb = new Uint8Array(0)

  constructor (rb, n_headers = 16) {
    this.rb = rb.ptr ? rb : ptr(rb)
    this.#num_headers[0] = n_headers
    if (n_headers !== 16) {
      this.#raw_headers = ptr(new Uint32Array(8 * n_headers))
    }
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


class RequestParser {
  #method = ptr(new Uint32Array(2))
  #method_len = ptr(new Uint32Array(2))
  #path = ptr(new Uint32Array(2))
  #path_len = ptr(new Uint32Array(2))
  #minor_version = ptr(new Uint32Array(1))
  #raw_headers = ptr(new Uint32Array(8 * 16))
  #num_headers = ptr(new Uint32Array(2))
  rb = new Uint8Array(0)

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
    const method_address = addr(this.#method)
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

export { RequestParser, ResponseParser, pico }
