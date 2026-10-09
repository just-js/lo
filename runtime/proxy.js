// TLS-terminating relay in front of a plaintext backend (openvscode-server).
// Browser webviews (markdown preview etc.) need a "secure context" -- see
// PLAN.md task 18 / PROXY.md for the full why. This gives openvscode-server
// one without touching openvscode-server itself: terminate TLS here, relay
// raw decrypted bytes to the plaintext backend over loopback, unchanged.
//
// Deliberately protocol-agnostic below the TLS layer -- never parses HTTP,
// so the WebSocket upgrade VS Code's own connection uses just rides along
// as bytes.
//
// Real backpressure handling (see PROXY.md's "hanging" postmortem): a v1
// of this that fired-and-forgot SSL_write/send return values silently
// dropped bytes under load (confirmed: a 20MB payload came back truncated
// and the client hung waiting for the rest). `lib/loop.js`'s poll() calls
// `callbacks[fd](fd)` with no event-type info -- one callback per fd, no
// way to know from the call itself whether it fired for readable or
// writable -- so each fd's callback checks connection state itself:
// flush any pending write first, otherwise read. Flags are toggled via
// loop.modify() (Writable only added while there's a backlog, removed
// once flushed) rather than always registering ReadableWritable, since a
// socket is "writable" almost all the time when idle -- registering that
// unconditionally would busy-loop.
import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { libssl } from 'lib/libssl.js'
import { Stats } from 'lib/bench.js'

const { assert, core, getenv, ptr, cstr } = lo
const { fcntl, O_NONBLOCK, F_SETFL } = core
const {
  socket, bind, listen, accept, connect, close, setsockopt, recv, send
} = net
const {
  SOCK_STREAM, AF_INET, SOMAXCONN, SO_REUSEPORT, SOL_SOCKET, SOCKADDR_LEN,
  IPPROTO_TCP, TCP_NODELAY
} = net
const { sockaddr_in } = net.types
const { Blocked } = Loop
const {
  SSL_set_fd, SSL_set_accept_state, SSL_accept,
  SSL_CTX_use_certificate_chain_file, SSL_CTX_use_PrivateKey_file,
  SSL_read, SSL_write, SSL_get_error, TLS_server_method, SSL_CTX_new,
  SSL_new, SSL_CTX_set_read_ahead, SSL_CTX_set_mode, SSL_free, SSL_shutdown,
  SSL_MODE_ACCEPT_MOVING_WRITE_BUFFER, SSL_FILETYPE_PEM
} = libssl

const INSECURE = 0
const SECURE = 1
const BUFSIZE = 64 * 1024

function on_timer () {
  stats.log()
}

// Both the client (TLS) fd and its paired backend (plaintext) fd map to
// the same connection object, so an event on either side can find the
// other -- close_conn tears both down together, whichever side triggers it.
//
// SSL_shutdown before SSL_free: closing a TLS connection by just freeing
// the SSL object / closing the fd, without ever sending a close_notify
// alert, looks to a strict peer (Node's TLS stack, among others) like a
// truncation attack rather than a clean end-of-data -- even if every byte
// of the actual response already arrived. Confirmed directly: without
// this, a real 20MB transfer over this proxy delivered all the bytes but
// the client's 'end' event never fired, hanging indefinitely. One
// best-effort call (ignoring its return -- it can legitimately report
// WANT_READ/WANT_WRITE if it'd need another round trip to see the peer's
// own close_notify back, which isn't worth blocking teardown on here) is
// enough to send our half of it before closing.
function close_conn (conn) {
  if (conn.closed) return
  conn.closed = true
  if (conn.ssl) {
    SSL_shutdown(conn.ssl)
    SSL_free(conn.ssl)
    conn.ssl = 0
  }
  loop.remove(conn.clientFd)
  close(conn.clientFd)
  connections.delete(conn.clientFd)
  loop.remove(conn.backendFd)
  close(conn.backendFd)
  connections.delete(conn.backendFd)
  stats.conn--
}

function on_error (fd) {
  const conn = connections.get(fd)
  if (conn) close_conn(conn)
}

function want_retry (ssl, rc) {
  const err = SSL_get_error(ssl, rc)
  return err === libssl.SSL_ERROR_WANT_READ || err === libssl.SSL_ERROR_WANT_WRITE
}

// ---- client (TLS) -> backend (plaintext) ----

function read_from_client (conn) {
  const bytes = SSL_read(conn.ssl, client_buf.ptr, BUFSIZE, 0)
  if (bytes > 0) {
    stats.recv += bytes
    write_to_backend(conn, client_buf, bytes)
    return
  }
  if (bytes < 0 && want_retry(conn.ssl, bytes)) return
  close_conn(conn)
}

// send() on a plain socket genuinely does partial writes -- unlike
// SSL_write below, the backpressure case here is the common one, not the
// exception. Retrying send() with a moved pointer is fine (no equivalent
// restriction to SSL_write's, below) -- but the *source* bytes still need
// to survive across event-loop iterations, so this copies the unsent tail
// into the connection's own dedicated buffer rather than pointing back
// into the shared scratch buffer, which the next unrelated read would
// otherwise overwrite before this drains.
function write_to_backend (conn, buf, len) {
  const written = send(conn.backendFd, buf.ptr, len, 0)
  if (written === len) {
    stats.send += written
    return
  }
  const sent = written > 0 ? written : 0
  if (sent > 0) stats.send += sent
  conn.pendingToBackendBuf.set(buf.subarray(sent, len))
  conn.pendingToBackendLen = len - sent
  conn.pendingToBackendOffset = 0
  // Stop reading more from the client until the backend drains -- otherwise
  // the backlog just grows unbounded instead of applying real backpressure.
  loop.modify(conn.clientFd, on_client_fd_event, 0, on_error)
  loop.modify(conn.backendFd, on_backend_fd_event, Loop.Writable, on_error)
}

function flush_to_backend (conn) {
  const remaining = conn.pendingToBackendLen - conn.pendingToBackendOffset
  const written = send(conn.backendFd, conn.pendingToBackendBuf.ptr + conn.pendingToBackendOffset, remaining, 0)
  if (written === remaining) {
    stats.send += written
    conn.pendingToBackendLen = 0
    loop.modify(conn.backendFd, on_backend_fd_event, Loop.Readable, on_error)
    loop.modify(conn.clientFd, on_client_fd_event, Loop.Readable, on_error)
    return
  }
  if (written > 0) {
    stats.send += written
    conn.pendingToBackendOffset += written
    return
  }
  if (written < 0 && lo.errno === Blocked) return
  close_conn(conn)
}

// ---- backend (plaintext) -> client (TLS) ----

function read_from_backend (conn) {
  const bytes = recv(conn.backendFd, backend_buf.ptr, BUFSIZE, 0)
  if (bytes > 0) {
    stats.recv += bytes
    queue_to_client(conn, backend_buf, bytes)
    return
  }
  if (bytes < 0 && lo.errno === Blocked) return
  if (bytes === 0) {
    // Clean EOF from the backend -- e.g. a normal HTTP response finishing.
    // Only safe to tear the whole connection down once there's nothing
    // still queued to relay to the client; closing mid-flush is exactly
    // what truncated the 20MB test (backend closed fast, over loopback,
    // well before a slower TLS-encrypting relay to the client had drained
    // its backlog). If a flush is still pending, mark it and let
    // flush_to_client finish the job once it empties the queue.
    if (conn.pendingToClientLen > 0) {
      conn.backendEOF = true
      return
    }
    close_conn(conn)
    return
  }
  close_conn(conn)
}

// SSL_write, without SSL_MODE_ENABLE_PARTIAL_WRITE (not set here), doesn't
// do partial writes -- it's either the whole buffer or <=0 (retry/error).
//
// Confirmed directly, the hard way: **every** SSL_write call for a given
// chunk -- including the very first attempt, not just retries after it --
// must use the exact same pointer for that chunk to ever succeed.
// SSL_MODE_ACCEPT_MOVING_WRITE_BUFFER (set below, at ctx creation) did not
// relax this in practice here: staging into a dedicated per-connection
// buffer only *after* the first attempt failed still changed the pointer
// between that failed attempt and the first retry, and produced
// SSL_ERROR_SSL (a real protocol-level error, not WANT_WRITE) -- diagnosed
// by tracing every call and its exact SSL_get_error code, not guessed.
// Fix: always stage into the connection's own dedicated buffer *before*
// the first attempt too, so literally every SSL_write call for a given
// chunk -- first attempt included -- uses the same stable pointer.
function queue_to_client (conn, buf, len) {
  conn.pendingToClientBuf.set(buf.subarray(0, len))
  conn.pendingToClientLen = len
  try_write_to_client (conn, false)
}

function flush_to_client (conn) {
  try_write_to_client (conn, true)
}

function try_write_to_client (conn, wasPending) {
  const written = SSL_write(conn.ssl, conn.pendingToClientBuf.ptr, conn.pendingToClientLen)
  if (written === conn.pendingToClientLen) {
    stats.send += written
    conn.pendingToClientLen = 0
    if (!wasPending) return
    if (conn.backendEOF) {
      // Backend closed while this was draining -- now that the client is
      // fully caught up, there's nothing left to relay either direction.
      close_conn(conn)
      return
    }
    loop.modify(conn.clientFd, on_client_fd_event, Loop.Readable, on_error)
    loop.modify(conn.backendFd, on_backend_fd_event, Loop.Readable, on_error)
    return
  }
  // written < pendingToClientLen here always means <=0 (see comment above)
  // -- SSL_write never partially drains a single call the way plain
  // send() does, so there's no partial-progress case to persist, just
  // retry-or-give-up. pendingToClientLen/pendingToClientBuf are already
  // exactly what the next retry needs, untouched.
  if (!want_retry(conn.ssl, written)) {
    close_conn(conn)
    return
  }
  if (!wasPending) {
    loop.modify(conn.backendFd, on_backend_fd_event, 0, on_error)
    loop.modify(conn.clientFd, on_client_fd_event, Loop.Writable, on_error)
  }
}

// ---- per-fd dispatch: one callback each, state decides what it means ----

function on_client_fd_event (fd) {
  const conn = connections.get(fd)
  if (!conn) return
  if (conn.pendingToClientLen > 0) {
    flush_to_client(conn)
    return
  }
  if (conn.state === INSECURE) {
    const rc = SSL_accept(conn.ssl)
    if (rc === 1) {
      conn.state = SECURE
    } else if (rc === 0) {
      close_conn(conn)
      return
    } else {
      if (want_retry(conn.ssl, rc)) return
      close_conn(conn)
      return
    }
  }
  read_from_client(conn)
}

function on_backend_fd_event (fd) {
  const conn = connections.get(fd)
  if (!conn) return
  if (conn.pendingToBackendLen > conn.pendingToBackendOffset) {
    flush_to_backend(conn)
    return
  }
  read_from_backend(conn)
}

function create_secure_socket (fd) {
  const ssl = assert(SSL_new(ctx))
  assert(SSL_set_fd(ssl, fd) === 1)
  SSL_set_accept_state(ssl)
  return ssl
}

// Blocking connect: the backend is always loopback (openvscode-server on
// 127.0.0.1), sub-millisecond to accept an already-listening local server.
// Sidesteps getsockopt(SO_ERROR)-based nonblocking-connect bookkeeping --
// SO_ERROR isn't even exported by lib/net/api.js today -- for a real but
// negligible-cost simplification. See PROXY.md.
function connect_backend () {
  const fd = socket(AF_INET, SOCK_STREAM, 0)
  assert(fd > 2)
  const rc = connect(fd, sockaddr_in(BACKEND_ADDRESS, BACKEND_PORT).ptr, SOCKADDR_LEN)
  if (rc !== 0) {
    close(fd)
    return -1
  }
  assert(fcntl(fd, F_SETFL, O_NONBLOCK) === 0)
  assert(!setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, net.on.ptr, 4))
  return fd
}

function on_client_connect (sfd) {
  // we could use accept4 on linux and set non blocking here but macos does not have it
  const fd = accept(sfd, 0, 0)
  if (fd > 0) {
    const backendFd = connect_backend()
    if (backendFd < 0) {
      close(fd)
      return
    }
    assert(fcntl(fd, F_SETFL, O_NONBLOCK) === 0)
    assert(!setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, net.on.ptr, 4))
    const conn = {
      clientFd: fd, backendFd, ssl: create_secure_socket(fd),
      state: INSECURE, closed: false,
      // Dedicated per-connection buffers for backpressure retries -- not
      // the shared client_buf/backend_buf scratch buffers, which a
      // different connection's read could overwrite mid-flush, and
      // (for the SSL_write side specifically) not freshly
      // sliced/reallocated per retry either -- see write_to_client's
      // comment for why that broke under real load.
      pendingToBackendBuf: ptr(new Uint8Array(BUFSIZE)),
      pendingToBackendLen: 0, pendingToBackendOffset: 0,
      pendingToClientBuf: ptr(new Uint8Array(BUFSIZE)),
      pendingToClientLen: 0,
      backendEOF: false
    }
    connections.set(fd, conn)
    connections.set(backendFd, conn)
    assert(loop.add(fd, on_client_fd_event, Loop.Readable, on_error) === 0)
    assert(loop.add(backendFd, on_backend_fd_event, Loop.Readable, on_error) === 0)
    stats.conn++
    return
  }
  if (lo.errno === Blocked) return
  close(fd)
}

function on_accept_error (fd, mask) {
  console.log(`accept error on socket ${fd} : ${mask}`)
}

function start_server (addr, port) {
  const fd = socket(AF_INET, SOCK_STREAM, 0)
  assert(fd > 2)
  assert(fcntl(fd, F_SETFL, O_NONBLOCK) === 0)
  assert(!setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, net.on.ptr, 32))
  assert(bind(fd, sockaddr_in(addr, port).ptr, SOCKADDR_LEN) === 0)
  assert(listen(fd, SOMAXCONN) === 0)
  assert(loop.add(fd, on_client_connect, Loop.Readable, on_accept_error) === 0)
  return fd
}

const loop = new Loop()
const client_buf = ptr(new Uint8Array(BUFSIZE))
const backend_buf = ptr(new Uint8Array(BUFSIZE))
const stats = new Stats()
const connections = new Map()
const method = assert(TLS_server_method())
const ctx = assert(SSL_CTX_new(method))
const key_name = cstr(getenv('KEY_FILE') || 'key.pem')
const cert_name = cstr(getenv('CERT_FILE') || 'cert.pem')
assert(SSL_CTX_use_PrivateKey_file(ctx, key_name.ptr, SSL_FILETYPE_PEM) === 1)
assert(SSL_CTX_use_certificate_chain_file(ctx, cert_name.ptr) === 1)
SSL_CTX_set_read_ahead(ctx, 1)
SSL_CTX_set_mode(ctx, SSL_MODE_ACCEPT_MOVING_WRITE_BUFFER)

const LISTEN_ADDRESS = getenv('LISTEN_ADDRESS') || '0.0.0.0'
const LISTEN_PORT = parseInt(getenv('LISTEN_PORT') || '3443', 10)
const BACKEND_ADDRESS = getenv('BACKEND_ADDRESS') || '127.0.0.1'
const BACKEND_PORT = parseInt(getenv('BACKEND_PORT') || '3000', 10)

console.log(`tls proxy: https 0.0.0.0:${LISTEN_PORT} -> plain ${BACKEND_ADDRESS}:${BACKEND_PORT}`)
const timer = new Timer(loop, 5000, on_timer)
const fd = start_server(LISTEN_ADDRESS, LISTEN_PORT)
while (loop.poll() > 0) {}
timer.close()
close(fd)
