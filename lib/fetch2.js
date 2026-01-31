import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { libssl } from 'lib/libssl.js'
import { ResponseParser, parse_url, pico } from 'lib/pico.js'
import { Resolver } from 'lib/dns.js'

const { assert, ptr } = lo
const { socket, connect, close, send_string, recv2 } = net
const { sockaddr_in } = net.types
const { Blocked } = Loop
const { 
  SOCK_STREAM, AF_INET, SOCKADDR_LEN, EINPROGRESS, SOCK_NONBLOCK
} = net
const {
  SSL_set_fd, SSL_set_connect_state, SSL_do_handshake, SSL_free, SSL_read, 
  SSL_write_string, SSL_get_error, TLS_client_method, SSL_CTX_new, SSL_new, 
  SSL_ERROR_WANT_READ, SSL_ERROR_WANT_WRITE, default_options, SSL_CTX_set_options,
  SSL_shutdown
} = libssl

function close_socket (sock, loop) {
  const { protocol, address, port } = sock
  const key = `${protocol}:${address}:${port}`
  if (sockets.has(key)) sockets.delete(key)
  if (sock.ssl > 0) sock.free()
  const { fd } = sock
  if (fd > 0) {
    if (loop) loop.remove(fd)
//    console.log(`close ${fd}`)
    close(fd)
  }
  sock.ssl = 0
  sock.fd = 0
}

const ssl_contexts = new Map()

function get_ssl_context (hostname, port) {
  const key = `${hostname}:${port}`
  if (ssl_contexts.has(key)) return ssl_contexts.get(key)
//  console.log('new context')
  const ctx = assert(SSL_CTX_new(assert(TLS_client_method())))
  ssl_contexts.set(key, ctx)
  return ctx
}

function create_socket (fd, loop, protocol, path, hostname, address, port) {
  const buf = new Uint8Array(BUFSIZE)
  const key = `${protocol}:${address}:${port}`
  if (protocol === 'https') {
    const ctx = get_ssl_context(hostname, port)
    SSL_CTX_set_options(ctx, default_options | libssl.SSL_OP_NO_COMPRESSION | 
      libssl.SSL_MODE_RELEASE_BUFFERS)
    const ssl = assert(SSL_new(ctx))
    assert(SSL_set_fd(ssl, fd) === 1)
    SSL_set_connect_state(ssl)
    const sock = {
      parser: new ResponseParser(buf, 32), 
      fd, 
      ssl, 
      state: INSECURE,
      protocol,
      path,
      hostname,
      address,
      port,
      free: () => {
        return SSL_free(ssl)
      },
      read: (ptr, len) => {
        return SSL_read(ssl, ptr, len)
      },
      write: str => {
        return SSL_write_string(ssl, str)
      },
      handshake: () => {
        return set_secure(sock)
      },
      close: () => {
        return close_socket(sock, loop)
      }
    }
    return sock
  }
  const sock = {
    parser: new ResponseParser(buf, 32), 
    fd, 
    protocol,
    path,
    hostname,
    port,
    read: (ptr, len) => {
      return recv2(fd, ptr, len, 0)
    },
    write: (str, len) => {
      return send_string(fd, str)
    },
    close: () => {
      return close_socket(sock, loop)
    }
  }
  return sock
}

function set_secure (sock) {
  const { ssl, state } = sock
  if (state === SECURE) return true
  const rc = SSL_do_handshake(ssl)
  if (rc === 1) {
    sock.state = SECURE
    return true
  } else if (rc === 0) {
    sock.close()
    return false
  }
  const err = SSL_get_error(ssl, rc)
  if (err === SSL_ERROR_WANT_READ || 
    err === SSL_ERROR_WANT_WRITE) return false
  sock.close()
  return false
}

const noop = () => {}

function handle_response (sock, callback) {
  const { parser, ssl, state, path, hostname, port, response, address, protocol } = sock
  if (ssl && state === INSECURE && sock.handshake()) {
    const written = sock.write(create_request(path, hostname, port))
    return
  }
  const key = `${protocol}:${address}:${port}`
  const { start, sz, headers_done, chunked } = response
  const bytes = sock.read(parser.rb.ptr + start, BUFSIZE - start)
  if (bytes > 0) {
    if (headers_done) {
      if (chunked) {
        const { chunk_decoder } = response
        sz[0] = bytes
        const rc = pico.decode_chunked(chunk_decoder.ptr, parser.rb.ptr, sz.ptr)
        if (rc === -2 || rc > 0) {
          if (sz[0] > 0) {
            response.on_bytes(parser.rb.subarray(0, sz[0]))
          }
          response.body_bytes += sz[0]
          if (rc > 0) {
            sockets.set(key, sock)
            response.on_complete()       
          }
        } else {
          console.log('error decoding')
          sock.close()
        }
      } else {
        response.on_bytes(parser.rb.subarray(0, bytes))
        response.body_bytes += bytes
        if (response.body_bytes === response.content_length) {
          sockets.set(key, sock)
          response.on_complete()       
        }
      }
      return
    } else {
      const parsed = parser.parse(bytes + start)
      if (parsed > 0) {
        const { status, headers, minor_version, num_headers, message } = parser
        if (headers.transfer_encoding && headers.transfer_encoding === 'chunked') {
          response.chunked = true
          if (!response.chunk_decoder) response.chunk_decoder = ptr(new Uint8Array(pico.struct_phr_chunked_decoder_size))
        } else {
          response.content_length = parseInt(headers.content_length || '0', 10)
        }
        response.status = status
        response.minor_version = minor_version
        response.num_headers = num_headers
        response.message = message
        response.headers_done = true
        Object.assign(response.headers, headers)
        callback(null, response)
        if (parsed < bytes + start) {
          const remaining = (bytes + start) - parsed
          if (response.chunked) {
            sz[0] = remaining
            const rc = pico.decode_chunked(response.chunk_decoder.ptr, parser.rb.ptr + parsed, sz.ptr)
            if (rc === -2 || rc > 0) {
              response.on_bytes(parser.rb.subarray(parsed, parsed + sz[0]))
              response.body_bytes += sz[0]
              if (rc > 0) {
                sockets.set(key, sock)
                response.on_complete()
              }
            } else {
              console.log('error decoding')
              sock.close()
            }
          } else {
            response.body_bytes += remaining
            response.on_bytes(parser.rb.subarray(parsed, parsed + remaining))
//            console.log(`remaining ${remaining} body_bytes ${response.body_bytes} content_length ${response.content_length}`)
            if (response.body_bytes === response.content_length) {
              sockets.set(key, sock)
              response.on_complete()       
            }
          }
        }
        response.start = 0
        return
      }
      if (parsed === -2) {
        response.start += bytes
        return
      }
      sock.close()
      return
    }
  }
  if (bytes < 0 && lo.errno === Blocked) return
  //close_socket(fd, loop)
}

function create_request (path, hostname, port) {
  //const payload = `GET ${path} HTTP/1.1\r\nHost: ${hostname}${(port === 80 || port === 443) ? '' : ':' + port}\r\nConnection: close\r\nAccept: */*\r\n\r\n`
  return `GET ${path} HTTP/1.1\r\nHost: ${hostname}${(port === 80 || port === 443) ? '' : ':' + port}\r\nAccept: */*\r\n\r\n`
}

function http_get (url, loop, callback) {
  const { protocol, hostname, path, port } = parse_url(url)
  const resolver = new Resolver(loop)
  resolver.lookup(hostname, (err, ip) => {
    if (err) return callback(err)
    const key = `${protocol}:${ip}:${port}`
    if (sockets.has(key)) {
//      console.log('got from cache')
      const sock = sockets.get(key)
      const { response } = sock
      response.content_length = 0
      response.body_bytes = 0
      response.chunked = false
      response.start = 0
      response.status = 0
      response.num_headers = 0
      response.message = ''
      response.headers_done = false
      response.headers = {}
      sockets.delete(key)
      sock.write(create_request(path, hostname, port))
      return
    }
    const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
    console.log(`connect ${ip} : ${port}`)
    assert(connect(fd, sockaddr_in(ip, port).ptr, SOCKADDR_LEN) > 0 || lo.errno === EINPROGRESS)
    const sock = create_socket(fd, loop, protocol, path, hostname, ip, port)
//    sockets.set(key, sock)
    assert(loop.add(fd, () => {
      if (sock.ssl) {
        if (sock.handshake()) {
          sock.write(create_request(path, hostname, port))
        }
      } else {
        sock.write(create_request(path, hostname, port))
      }
      sock.response = {
        fd,
        content_length: 0,
        chunked: false,
        body_bytes: 0,
        start: 0,
        status: 0,
        minor_version: 0,
        num_headers: 0,
        message: '',
        headers_done: false,
        headers: {},
        protocol,
        on_complete: noop,
        on_bytes: noop,
        on_error: noop,
        close: sock.close,
        sz: ptr(new Uint32Array(2))
      }
      assert(loop.modify(fd, () => handle_response(sock, callback), Loop.Readable, sock.close) === 0)
    }, Loop.Writable | Loop.EdgeTriggered, sock.close) === 0)
  })
}

function deferred () {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function fetch (url, loop = globalThis.loop) {
  return new Promise ((resolve, reject) => {
    http_get(url, loop, (err, res) => {
      if (err) {
        reject(err)
        return
      }
      let off = 0
      const { content_length = 0 } = res
      const body = new Uint8Array(content_length || (1 * 1024 * 1024 * 1024))
      const deferred_promise = deferred()

      res.on_bytes = buf => {
        body.set(buf, off)
        off += buf.length
      }

      res.bytes = () => deferred_promise.promise

      res.on_complete = () => {
        deferred_promise.resolve(body.subarray(0, off))
      }

      res.on_error = err => {
        deferred_promise.reject(err)
      }

      resolve(res)
//      console.log('resolved')
    })
  })  
}

const BUFSIZE = 65536
const INSECURE = 0
const SECURE = 1
const sockets = new Map()

export { fetch, http_get }