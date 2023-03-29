import { system } from 'lib/system.js'
import { net } from 'lib/net.js'

const { timer } = system

class Timer {
  fd = 0
  loop = undefined
  timeout = 1000
  repeat = 1000
  callback = undefined
  #tb = undefined

  constructor (loop, timeout, callback, repeat = timeout) {
    this.loop = loop
    this.timeout = timeout
    this.callback = callback
    this.repeat = repeat
    this.fd = timer(this.timeout, this.repeat)
    this.#tb = new spin.RawBuffer(8)
    loop.add(this.fd, () => {
      net.read(this.fd, this.#tb.ptr, 8)
      callback()
    })
  }

  close () {
    net.close(this.fd)
  }
}

export { Timer }
