const { assert, core, ptr } = lo

const { os } = core

let Timer

if (os === 'mac') {

const { close } = core
const { kevents } = lo.load('kevents')

let timer_id = 0

class MacTimer {
  fd = 0
  loop = undefined
  timeout = 1000
  repeat = 1000
  callback = undefined

  constructor (loop, timeout, callback, repeat = timeout) {
    this.loop = loop
    this.timeout = timeout
    this.callback = callback
    this.repeat = repeat
    this.fd = timer_id++
    loop.add_data(this.fd, callback, kevents.EVFILT_TIMER, timeout)
  }

  close () {
    this.loop.remove(this.fd, kevents.EVFILT_TIMER)
    close(this.fd)
  }
}

Timer = MacTimer

} else if (os === 'linux') {

const { read, close } = core
const { system } = lo.load('system')

const CLOCK_MONOTONIC = 1
const TFD_NONBLOCK = 2048
const TFD_CLOEXEC = 524288

function timer (repeat, timeout = repeat) {
  const itimerspec = ptr(new Uint8Array(32))
  const u64 = new BigUint64Array(itimerspec.buffer)
  u64[0] = BigInt(Math.floor(repeat / 1000))
	u64[1] = BigInt((repeat % 1000) * 1000000)
	u64[2] = BigInt(Math.floor(timeout / 1000))
	u64[3] = BigInt((timeout % 1000) * 1000000)
  const fd = system.timerfd_create(CLOCK_MONOTONIC, TFD_NONBLOCK | TFD_CLOEXEC)
  if (fd < 0) return fd
  const rc = system.timerfd_settime(fd, 0, itimerspec.ptr, 0);
  if (rc < 0) return rc
  return fd
}

class UnixTimer {
  fd = 0
  loop = undefined
  timeout = 1000
  repeat = 1000
  callback = undefined

  constructor (loop, timeout, callback, repeat = timeout) {
    this.loop = loop
    this.timeout = timeout
    this.callback = callback
    this.repeat = repeat
    this.fd = timer(this.timeout, this.repeat)
    assert(this.fd > 2)
    const tb = ptr(new Uint8Array(8))
    assert(loop.add(this.fd, () => {
      read(this.fd, tb.ptr, 8)
      callback()
    }) === 0)
  }

  close () {
    this.loop.remove(this.fd)
    close(this.fd)
  }
}

Timer = UnixTimer

}

export { Timer }
