import { bindall } from 'lib/fast.js'
import { runtime } from './runtime.js'

const { assert, ptr } = spin

function on_socket_event(fd) {
  const bytes = recv(fd, recv_buf.ptr, 4096)
  if (bytes > 0) {
    if (parse_request(recv_buf.ptr, bytes, state_buf.ptr) === bytes) {
      send(fd, send_buf.ptr, send_buf.length)
      return
    }
  }
  if (bytes < 0 && spin.errno === EAGAIN) return
  if (bytes < 0) console.error(`socket_error : ${spin.errno}`)
  modify(poll_fd, EPOLL_CTL_DEL, fd, 0)
  close(fd)
}

function on_accept() {
  const sfd = accept(listen_fd, 0, 0, O_NONBLOCK)
  if (sfd > 0) {
    assert(modify(poll_fd, EPOLL_CTL_ADD, sfd, event(sfd).ptr) !== -1)
    return
  }
  if (spin.errno === EAGAIN) return
  close(sfd)
}

function poll() {
  const num_events = wait(poll_fd, events_buf.ptr, 4096, -1)
  let off = 0
  for (let i = 0; i < num_events; i++) {
    const mask = events_buf[off++]
    const event_fd = events_buf[off++]
    off++
    if (mask & EPOLLERR || mask & EPOLLHUP) {
      close(event_fd)
      continue
    }
    if (listen_fd === event_fd) {
      on_accept()
      continue
    }
    on_socket_event(event_fd)
  }
  return num_events
}

const { http, epoll, sockets } = bindall(runtime)
const { parse_request } = http
const {
  send, socket, setsockopt, listen, close, accept, recv, bind, sockaddr_in,
  SOCK_STREAM, SOCK_NONBLOCK, AF_INET, SOL_SOCKET, SOCKADDR_LEN, SO_REUSEPORT,
  SOMAXCONN, O_NONBLOCK
} = sockets
const {
  create, modify, wait, event, events, EPOLLIN, EPOLLERR, EPOLLHUP,
  EPOLL_CLOEXEC, EPOLL_CTL_ADD, EPOLL_CTL_DEL, EAGAIN
} = epoll

const recv_buf = ptr(new Uint8Array(4096))
const state_buf = ptr(new Uint8Array(32 + (32 * 32)))
const encoder = new TextEncoder()
const on = ptr(new Uint32Array([1]))
const events_buf = events(4096)
const send_buf = ptr(encoder.encode(`HTTP/1.1 200 OK\r
Date: ${(new Date()).toUTCString()}\r
Content-Type: text/plain; charset=utf-8\r
Content-Length: 15\r
\r
Hello from spin`))

const listen_fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
assert(listen_fd !== -1)
assert(!setsockopt(listen_fd, SOL_SOCKET, SO_REUSEPORT, on.ptr, 32))
assert(!bind(listen_fd, sockaddr_in('127.0.0.1', 3000).ptr, SOCKADDR_LEN))
assert(!listen(listen_fd, SOMAXCONN))
const poll_fd = create(EPOLL_CLOEXEC)
assert(poll_fd > 0)
assert(modify(poll_fd, EPOLL_CTL_ADD, listen_fd, 
  event(listen_fd, EPOLLIN).ptr) !== -1)
while (poll() !== -1) { }
