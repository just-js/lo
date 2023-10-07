import { Socket } from 'lib/socket.js'
import { Loop } from 'lib/loop.js'
import * as tcc from 'lib/tcc.js'
import { pico } from 'lib/pico.js'
import { system } from 'lib/system.js'
import { dump } from 'lib/binary.js'

const { rustls } = spin.load('rustls')

const RUSTLS_RESULT_OK = 7000
const RUSTLS_RESULT_PLAINTEXT_EMPTY = 7011

rustls.version = spin.wrap(new Uint32Array(2), rustls.version, 0)
rustls.client_config_builder_new = spin.wrap(new Uint32Array(2), rustls.client_config_builder_new, 0)
rustls.client_config_builder_build = spin.wrap(new Uint32Array(2), rustls.client_config_builder_build, 1)

function byteSlice (str) {
  const b64 = new BigUint64Array(2)
  const slice = encoder.encode(str)
  b64[0] = BigInt(spin.getAddress(slice))
  b64[1] = BigInt(slice.length)
  const u8 = new Uint8Array(b64.buffer)
  return { slice, u8 }
}

const compiler = new tcc.Compiler()
compiler.compile(`
#include <stdint.h>
#include <stdlib.h>
#include <errno.h>
#include <unistd.h>

struct user_data {
  int fd;
};

int do_write (struct user_data* userdata, const uint8_t* buf, size_t n, size_t* out_n) {
  int bytes = write(userdata->fd, buf, n);
  if (bytes == -1) return errno;
  *out_n = bytes;
  return 0;
}

int do_read (struct user_data* userdata, uint8_t* buf, size_t n, size_t* out_n) {
  int bytes = read(userdata->fd, buf, n);
  if (bytes == -1) return errno;
  *out_n = bytes;
  return 0;
}
`)

const do_read = compiler.symbol('do_read')
const do_write = compiler.symbol('do_write')

// https://codeload.github.com/oven-sh/bun/tar.gz/bun-v0.5.9

const hostname = 'codeload.github.com'
const port = 443
const ip = '140.82.121.9'
const encoder = new TextEncoder()
const handle = new Uint32Array(2)
const address = rustls.version()
spin.assert(address)
const version = spin.utf8Decode(address, -1)
const config = rustls.client_config_builder_new()
spin.assert(config)
const alpn = byteSlice('http/1.1')
spin.assert(alpn.u8.length === 16)
spin.assert(alpn.slice.length === 8)
// cacert.pem from here https://curl.se/ca/cacert.pem
spin.assert(rustls.client_config_builder_load_roots_from_file(config, 'util/example/cacert.pem') === RUSTLS_RESULT_OK)
spin.assert(rustls.client_config_builder_set_alpn_protocols(config, alpn.u8, 1) === RUSTLS_RESULT_OK)
const client_config = rustls.client_config_builder_build(config)
spin.assert(client_config)
spin.assert(rustls.client_connection_new(client_config, hostname, handle) === RUSTLS_RESULT_OK)
const tls_conn = spin.addr(handle)
spin.assert(tls_conn)
const eventLoop = new Loop()
const sock = new Socket(eventLoop)
const out_n = new Uint32Array(1)

const HTTP_CTX_SZ = 32
const HTTP_HEADER_SZ = 1024
const MAXHEADERS = 64
const sbuf = new Uint8Array(HTTP_CTX_SZ + (HTTP_HEADER_SZ * MAXHEADERS))
const state = new Uint32Array(sbuf.buffer)
const decoder = new TextDecoder()

async function connect () {
  await sock.connect(port, ip)
  console.log('connected')
  const user_data = new Uint32Array([sock.fd])
  const req = encoder.encode(`GET /oven-sh/bun/tar.gz/bun-v0.5.9 HTTP/1.1\r\nHost: ${hostname}\r\nAccept: */*\r\nConnection: close\r\n\r\n`)
  spin.assert(rustls.connection_write(tls_conn, req, req.length, out_n) === RUSTLS_RESULT_OK)
  spin.assert(out_n[0] === req.length)
  let headers = false
  let chunks = []
  let expectedLength = 0
  const buf = new Uint8Array(65536)
  while (1) {
    const want_write = rustls.connection_wants_write(tls_conn)
    if (want_write) {
      spin.assert(rustls.connection_write_tls(tls_conn, do_write, user_data, out_n) === 0)
      spin.assert(out_n[0] > 0)
    }
    const want_read = rustls.connection_wants_read(tls_conn)
    if (want_read) {
      const rc = rustls.connection_read_tls(tls_conn, do_read, user_data, out_n)
      if (rc === 0) {
        if (out_n[0] === 0) {
          break // EOF
        }
        spin.assert(out_n[0] > 0)
        spin.assert(rustls.connection_process_new_packets(tls_conn) === RUSTLS_RESULT_OK)
        const rc = rustls.connection_read(tls_conn, buf, buf.length, out_n)
        if (rc === RUSTLS_RESULT_OK) {
          if (out_n[0] === 0) {
            console.log('break')
            break // EOF
          }
//          console.log(out_n[0])
          if (!headers) {
            let bodyStart = 0
            //console.log(dump(buf.subarray(0, out_n[0])))
            //spin.fs.writeFile('dump.bin', buf.subarray(0, out_n[0]))
            const parsed = pico.parseResponse(buf.subarray(0, out_n[0]), out_n[0], state)
            console.log(parsed)
            if (parsed > 0) {
              const [version, status, nheader] = state
              console.log(`version ${version} status ${status} headers ${nheader}`)
              let off = 8
              for (let i = 0; i < nheader; i++) {
                const [nstart, nlen, vstart, vlen] = state.subarray(off, off + 4)
                const name = decoder.decode(buf.subarray(nstart, nstart + nlen))
                const value = decoder.decode(buf.subarray(vstart, vstart + vlen))
                if (name.toLowerCase() === 'content-length') {
                  expectedLength = parseInt(value, 10)
                }
                console.log(`${name}: ${value}`)
                bodyStart = vstart + vlen + 4
                off += 4
              }
              headers = true
              if (out_n[0] > bodyStart) {
                chunks.push(buf.slice(bodyStart, out_n[0]))
              }
            }
          } else {
            chunks.push(buf.slice(0, out_n[0]))
          }
        } else {
          spin.assert(rc === RUSTLS_RESULT_PLAINTEXT_EMPTY)
          system.usleep(100000)
        }
      } else {
        if (rc !== 11) break
      }
    }
    if (!want_read && !want_write) {
      const buf = new Uint8Array(4096)
      const rc = rustls.connection_read(tls_conn, buf, buf.length, out_n)
      if (rc === RUSTLS_RESULT_OK) {
        if (out_n[0] === 0) {
          break // EOF
        }
        chunks.push(buf.slice(0, out_n[0]))
      } else {
        spin.assert(rc === RUSTLS_RESULT_PLAINTEXT_EMPTY)
        system.usleep(100000)
      }
    }
  }
  rustls.connection_free(tls_conn)
  sock.close()
  console.log(chunks.reduce((p, c) => p + c.length, 0))
}

connect().catch(err => console.error(err.stack))

while (1) {
  spin.runMicroTasks()
  if (eventLoop.size === 0) break
  eventLoop.poll(-1)
}

rustls.client_config_free(client_config)
