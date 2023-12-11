const { assert, core } = lo
const { os } = core

let Loop

if (os === 'mac') {

const { kevents } = lo.load('kevents')
const { ptr, assert, core } = lo
const { close, EAGAIN } = core
const { 
  kqueue, kevent, 
  EVFILT_READ, EV_ADD, EV_ENABLE, EV_ERROR, EV_DELETE, EVFILT_WRITE,
  struct_timespec_size
} = kevents

const EVENT_SIZE = 8
const empty_timespec = ptr(new Uint8Array(struct_timespec_size))

function event (ident, filter, flags = 0, data) {
  const event = ptr(new Uint32Array(8))
  const view = new DataView(event.buffer)
  view.setUint32(0, ident, true)
  if (filter !== 0) view.setInt16(8, filter, true)
  if (flags !== 0) view.setUint16(10, flags, true)
  if (data) {
    view.setBigUint64(16, BigInt(data), true)
  }
  return event
}

function events (nevents = 1024) {
  return ptr(new Uint32Array(EVENT_SIZE * nevents))
}

const noop = () => {}

class MacLoop {
  #size = 0

  constructor (nevents = 4096, flags = 0) {
    this.maxEvents = nevents
    this.events = events(nevents)
    this.fd = assert(kqueue())
    this.callbacks = {}
    this.errors = {}
    this.handles = {}
  }

  get size () {
    return this.#size
  } 

  add (fd, callback, flags = EVFILT_READ, onerror = noop) {
    const set = event(fd, flags, EV_ADD | EV_ENABLE)
    assert(kevent(this.fd, set.ptr, 1, 0, 0, 0) === 0)
    this.callbacks[fd] = callback
    if (onerror) this.errors[fd] = onerror
    this.#size++
  }

  add_data (fd, callback, flags = EVFILT_READ, data, onerror = noop) {
    const set = event(fd, flags, EV_ADD | EV_ENABLE, data)
    assert(kevent(this.fd, set.ptr, 1, 0, 0, 0) === 0)
    this.callbacks[fd] = callback
    if (onerror) this.errors[fd] = onerror
    this.#size++
  }

  modify (fd, flags = EVFILT_READ, callback = this.handles[fd], onerror = noop) {
    return this.add(fd, callback, flags, onerror)
  }

  remove (fd, flags = EVFILT_READ) {
    const set = event(fd, flags, EV_DELETE)
    assert(kevent(this.fd, set.ptr, 1, 0, 0, 0) === 0)
    delete this.callbacks[fd]
    delete this.errors[fd]
    this.#size--
  }

  poll (timeout = -1) {
    if (this.#size === 0) return 0
    const { fd, maxEvents, events, callbacks, errors } = this
    const n = kevent(fd, 0, 0, events.ptr, maxEvents, timeout === -1 ? 0 : empty_timespec.ptr)
    let off = 0
    for (let i = 0; i < n; i++) {
      const mask = events[off + 2]
      if ((mask && 0xff) === EV_ERROR) {
        const fd = events[off]
        errors[fd](fd, mask)
        close(fd)
        delete callbacks[fd]
        delete errors[fd]
        this.#size--
        off += 8
        continue
      }
      const fd = events[off]
      callbacks[fd](fd)
      off += 8
    }
    return n
  }
}

MacLoop.Readable = EVFILT_READ
MacLoop.Writable = EVFILT_WRITE
MacLoop.ReadableWritable = MacLoop.Readable | MacLoop.Writable
MacLoop.EdgeTriggered = 0
MacLoop.Blocked = EAGAIN

Loop = MacLoop

} else if (os === 'linux') {

const { epoll } = lo.load('epoll')
const { create, wait, modify, close } = epoll

const {
  EPOLLIN, EPOLLOUT, EPOLLERR, EPOLLHUP, EPOLL_CLOEXEC, EPOLLEXCLUSIVE,
  EPOLLWAKEUP, EPOLLONESHOT, EPOLLET, EPOLL_CTL_ADD, EPOLL_CTL_DEL,
  EPOLL_CTL_MOD, EAGAIN, EVENT_SIZE
} = epoll

function event (fd, mask = EPOLLIN | EPOLLOUT) {
  const buf = new ArrayBuffer(EVENT_SIZE)
  const dv = new DataView(buf)
  dv.setUint32(0, mask, true)
  dv.setUint32(4, fd, true)
  return new Uint8Array(buf)
}

function events (nevents = 1024) {
  const buf = new ArrayBuffer(nevents * EVENT_SIZE)
  return new Uint32Array(buf)
}

epoll.types = {
  event,
  events
}

const noop = () => {}
const nullptr = new Uint8Array(8)

class UnixLoop {
  #size = 0

  constructor (nevents = 4096, flags = EPOLL_CLOEXEC) {
    this.maxEvents = nevents
    this.events = events(nevents)
    this.fd = create(flags)
    this.callbacks = {}
    this.errors = {}
    this.handles = {}
  }

  get size () {
    return this.#size
  } 

  add (fd, callback, flags = EPOLLIN, errHandler = noop) {
    const ev = event(fd, flags)
    const rc = modify(this.fd, EPOLL_CTL_ADD, fd, ev)
    if (rc === -1) return rc
    this.callbacks[fd] = callback
    this.errors[fd] = errHandler
    this.#size++
    return rc
  }

  // todo - make add/modify same signature, just use .callbacks, not .handles
  modify (fd, flags = EPOLLIN, callback = this.handles[fd], onerror = noop) {
    const ev = event(fd, flags)
    this.callbacks[fd] = callback
    return modify(this.fd, EPOLL_CTL_MOD, fd, ev)
  }

  remove (fd) {
    // TODO: don't delete these = pre-allocate an array
    delete this.callbacks[fd]
    delete this.errors[fd]
    this.#size--
    return modify(this.fd, EPOLL_CTL_DEL, fd, nullptr)
  }

  poll (timeout = -1) {
    if (this.#size === 0) return 0
    const { fd, maxEvents, events, callbacks, errors } = this
    const n = wait(fd, events, maxEvents, timeout)
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

UnixLoop.Readable = EPOLLIN
UnixLoop.Writable = EPOLLOUT
UnixLoop.ReadableWritable = EPOLLIN | EPOLLOUT
UnixLoop.EdgeTriggered = EPOLLET
UnixLoop.Blocked = EAGAIN

Loop = UnixLoop

}

export { Loop }
