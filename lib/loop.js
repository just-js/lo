const { assert, core, ptr } = lo
const { os } = core

let Loop

// todo: have a Loop class that the specific loops extend. this works better with types

if (os === 'mac') {

const { kevents } = lo.load('kevents')
const { close, EAGAIN } = core
const { 
  kqueue, kevent64,
  EVFILT_READ, EV_ADD, EV_ENABLE, EV_ERROR, EV_DELETE, EVFILT_WRITE,
  struct_timespec_size, struct_kevent64_s_size,
  KEVENT_FLAG_IMMEDIATE
} = kevents

const empty_timespec = ptr(new Uint8Array(struct_timespec_size))
const timespec = new Uint32Array(empty_timespec.buffer)

function event (ident, filter, flags = 0, fflags = 0, data_ptr = 0, udata_ptr = 0, ext) {
  const event = ptr(new Uint32Array(struct_kevent64_s_size))
  const view = new DataView(event.buffer)
  view.setUint32(0, ident, true)
  //view.setBigUint64(0, BigInt(ident), true)
  if (filter !== 0) view.setInt16(8, filter, true)
  if (flags !== 0) view.setUint16(10, flags, true)
  if (fflags !== 0) view.setUint32(12, flags, true)
  if (data_ptr) {
    view.setBigInt64(16, BigInt(data_ptr), true)
  }
  if (udata_ptr) {
    view.setBigUint64(24, BigInt(udata_ptr), true)
  }
  if (ext) {
    view.setBigUint64(32, BigInt(ext[0]), true)
    view.setBigUint64(40, BigInt(ext[1]), true)
  }
  return event
}

const noop = () => {}

class Event {
  #dv

  constructor (buf, off) {
    this.#dv = new DataView(buf.buffer, off, struct_kevent64_s_size)
  }

  get fd () {
    return this.#dv.getUint32(0, true)
  }

  get mask () {
    return this.#dv.getUint32(16, true)
  }
}

function wrapEvents (nevents) {
  const buf = ptr(new Uint8Array(struct_kevent64_s_size * nevents))
  const events = []
  let off = 0
  for (let i = 0; i < nevents; i++) {
    events.push(new Event(buf, off))
    off += struct_kevent64_s_size
  }
  events.ptr = buf.ptr
  return events
}

class MacLoop {
  #size = 0
  
  constructor (nevents = 4096, flags = 0) {
    this.maxEvents = nevents
    this.events = wrapEvents(nevents)
    this.fd = assert(kqueue())
    this.callbacks = {}
    this.errors = {}
    this.immediates = []
  }

  get size () {
    return this.#size
  } 

  setImmediate (fn) {
    this.immediates.push(fn)
  }

  add (fd, callback, flags = EVFILT_READ, onerror = noop) {
    const set = event(fd, flags, EV_ADD | EV_ENABLE)
    const rc = kevent64(this.fd, set.ptr, 1, 0, 0, 0, 0)
    if (rc !== 0) return rc
    this.callbacks[fd] = callback
    if (onerror) this.errors[fd] = onerror
    this.#size++
    return rc
  }

  add_data (fd, callback, flags = EVFILT_READ, data, onerror = noop) {
    const set = event(fd, flags, EV_ADD | EV_ENABLE, 0, data.ptr || data)
    const rc = kevent64(this.fd, set.ptr, 1, 0, 0, 0, 0)
    if (rc !== 0) return rc
    this.callbacks[fd] = callback
    if (onerror) this.errors[fd] = onerror
    this.#size++
    return rc
  }

  modify (fd, callback = this.callbacks[fd], flags = EVFILT_READ, onerror = noop) {
    return this.add(fd, callback, flags, onerror)
  }

  remove (fd, flags = EVFILT_READ) {
    delete this.callbacks[fd]
    delete this.errors[fd]
    this.#size--
    const set = event(fd, flags, EV_DELETE)
    return kevent64(this.fd, set.ptr, 1, 0, 0, 0, 0)
  }

  poll (timeout = -1, flags = 0) {
    const { fd, maxEvents, events, callbacks, errors, immediates } = this
    let imm_len = immediates.length
    let completions = 0
    if (this.#size === 0 && imm_len === 0) return 0
    if (timeout > 0) {
      timespec[0] = 0
      timespec[2] = timeout * 1000000
    }
    if (imm_len) {
      flags = flags | KEVENT_FLAG_IMMEDIATE
    }
    const n = kevent64(fd, 0, 0, events.ptr, maxEvents, flags, timeout === -1 ? 0 : empty_timespec.ptr)
    completions = n
    if (imm_len && n !== -1) {
      completions += imm_len
      while (imm_len--) {
        try {
          this.immediates.shift()()
        } catch (err) {

        }
      }
    }
    for (let i = 0; i < n; i++) {
      const { fd, mask } = events[i]
      if ((mask && 0xff) === EV_ERROR) {
        errors[fd](fd, mask)
        delete callbacks[fd]
        delete errors[fd]
        this.#size--
        continue
      }
      callbacks[fd](fd)
    }
    return completions
  }

  close () {
    return close(this.fd)
  }
}

MacLoop.Readable = EVFILT_READ
MacLoop.Writable = EVFILT_WRITE
MacLoop.ReadableWritable = MacLoop.Readable | MacLoop.Writable
MacLoop.EdgeTriggered = 0
MacLoop.Blocked = EAGAIN
MacLoop.Errored = EV_ERROR
MacLoop.Hangup = EV_ERROR

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
  return ptr(new Uint8Array(buf))
}

function events (nevents = 1024) {
  const buf = new ArrayBuffer(nevents * EVENT_SIZE)
  return ptr(new Uint32Array(buf))
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
  }

  get size () {
    return this.#size
  } 

  add (fd, callback = this.callbacks[fd], flags = EPOLLIN, onerror = noop) {
    const ev = event(fd, flags)
    const rc = modify(this.fd, EPOLL_CTL_ADD, fd, ev.ptr)
    if (rc === -1) return rc
    this.callbacks[fd] = callback
    if (onerror) this.errors[fd] = onerror
//    console.log(`add ${fd}`)
    this.#size++
    return rc
  }

  // todo - make add/modify same signature, just use .callbacks, not .handles
  modify (fd, callback = this.callbacks[fd], flags = EPOLLIN, onerror = noop) {
    const ev = event(fd, flags)
    this.callbacks[fd] = callback
    if (onerror) this.errors[fd] = onerror
    return modify(this.fd, EPOLL_CTL_MOD, fd, ev.ptr)
  }

  remove (fd) {
    // TODO: don't delete these = pre-allocate an array
    if (!this.callbacks[fd]) return 0
    delete this.callbacks[fd]
    delete this.errors[fd]
//    console.log(`remove ${fd}`)
    this.#size--
    return modify(this.fd, EPOLL_CTL_DEL, fd, nullptr)
  }

  poll (timeout = -1) {
    //if (this.#size === 0) timeout = 1
    if (this.#size === 0) return 0
    const { fd, maxEvents, events, callbacks, errors } = this
    const n = wait(fd, events.ptr, maxEvents, timeout)
    let off = 0
    for (let i = 0; i < n; i++) {
      const mask = events[off++]
      const fd = events[off++]
      if (mask & EPOLLERR || mask & EPOLLHUP) {
        errors[fd](fd, mask)
//        close(fd)
        this.remove(fd)
        off++
        continue
      }
      callbacks[fd](fd)
      off++
    }
    return n
  }

  close () {
    return close(this.fd)
  }
}

UnixLoop.Readable = EPOLLIN
UnixLoop.Writable = EPOLLOUT
UnixLoop.ReadableWritable = EPOLLIN | EPOLLOUT
UnixLoop.EdgeTriggered = EPOLLET
UnixLoop.Blocked = EAGAIN
UnixLoop.Errored = EPOLLERR
UnixLoop.Hangup = EPOLLHUP

Loop = UnixLoop

}

export { Loop }
