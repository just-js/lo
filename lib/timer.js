const { assert, fs } = spin

const { system } = spin.load('system')

const CLOCK_MONOTONIC = 1
const TFD_NONBLOCK = 2048
const TFD_CLOEXEC = 524288

function timer (repeat, timeout = repeat) {
  const itimerspec = new Uint8Array(32)
  const u64 = new BigUint64Array(itimerspec.buffer)
  u64[0] = BigInt(Math.floor(repeat / 1000))
	u64[1] = BigInt((repeat % 1000) * 1000000)
	u64[2] = BigInt(Math.floor(timeout / 1000))
	u64[3] = BigInt((timeout % 1000) * 1000000)
  const fd = system.timerfd_create(CLOCK_MONOTONIC, TFD_NONBLOCK | TFD_CLOEXEC)
  if (fd < 0) return fd
  const rc = system.timerfd_settime(fd, 0, itimerspec, 0);
  if (rc < 0) return rc
  return fd
}

class Timer {
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
    const tb = new Uint8Array(8)
    loop.add(this.fd, () => {
      fs.read(this.fd, tb, 8)
      callback()
    })
  }

  close () {
    fs.close(this.fd)
  }
}

export { Timer }
