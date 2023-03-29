const { loop } = spin.load('loop')

const { create, wait, modify, close } = loop

const EPOLLIN = 0x1
const EPOLLOUT = 0x4
const EPOLLERR = 0x8
const EPOLLHUP = 0x10
const EPOLL_CLOEXEC = 524288
const EPOLLEXCLUSIVE = 1 << 28
const EPOLLWAKEUP = 1 << 29
const EPOLLONESHOT = 1 << 30
const EPOLLET = 1 << 31
const EPOLL_CTL_ADD = 1
const EPOLL_CTL_DEL = 2
const EPOLL_CTL_MOD = 3
const EVENT_SIZE = 12

loop.constants = {
  EPOLLIN, EPOLLOUT, EPOLLERR, EPOLLHUP, EPOLL_CLOEXEC, EPOLLEXCLUSIVE,
  EPOLLWAKEUP, EPOLLONESHOT, EPOLLET, EPOLL_CTL_ADD, EPOLL_CTL_DEL,
  EPOLL_CTL_MOD
}

function event (fd, mask = EPOLLIN | EPOLLOUT) {
  const buf = new ArrayBuffer(EVENT_SIZE)
  const dv = new DataView(buf)
  dv.setUint32(0, mask, true)
  dv.setUint32(4, fd, true)
  const u8 = new Uint8Array(buf)
  u8.ptr = spin.getAddress(buf)
  return u8
}

function events (nevents = 1024) {
  const buf = new ArrayBuffer(nevents * EVENT_SIZE)
  const u32 = new Uint32Array(buf)
  u32.ptr = spin.getAddress(buf)
  return u32
}

loop.types = {
  event,
  events
}

const noop = () => {}

class Loop {
  #size = 0

  constructor (nevents = 4096, flags = EPOLL_CLOEXEC) {
    this.maxEvents = nevents
    this.events = events(nevents)
    this.fd = create(flags)
    this.callbacks = {}
    this.errors = {}
  }

  get size () {
    return this.#size
  } 

  add (fd, callback, flags = EPOLLIN, errHandler = () => {}) {
    const ev = event(fd, flags)
    const rc = modify(this.fd, EPOLL_CTL_ADD, fd, ev.ptr)
    if (rc === -1) return rc
    this.callbacks[fd] = callback
    this.errors[fd] = errHandler
    this.#size++
    return rc
  }

  modify (fd, flags = EPOLLIN, callback = this.handles[fd], onerror = noop) {
    const ev = event(fd, flags)
    this.callbacks[fd] = callback
    return modify(this.fd, EPOLL_CTL_MOD, fd, ev.ptr)
  }

  remove (fd) {
    delete this.callbacks[fd]
    delete this.errors[fd]
    this.#size--
    return modify(this.fd, EPOLL_CTL_DEL, fd, 0)
  }

  poll (timeout = -1) {
    const { fd, maxEvents, events, callbacks, errors } = this
    const n = wait(fd, events.ptr, maxEvents, timeout)
    let off = 0
    for (let i = 0; i < n; i++) {
      const mask = events[off++]
      const fd = events[off++]
      if (mask & EPOLLERR || mask & EPOLLHUP) {
        errors[fd](fd, mask)
        close(fd)
        delete callbacks[fd]
        delete errors[fd]
        this.#size--
        off++
        continue
      }
      callbacks[fd](fd)
      off++
    }
    return n
  }
}

Loop.Readable = EPOLLIN
Loop.Writable = EPOLLOUT
Loop.ReadableWritable = EPOLLIN | EPOLLOUT
Loop.EdgeTriggered = EPOLLET

export { loop, Loop }
