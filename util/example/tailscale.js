import { bind } from 'lib/fast.js'
import { system } from 'lib/system.js'
import { Loop } from 'lib/loop.js'
import { net } from 'lib/net.js'

const { assert, dlopen, dlsym, fs } = spin
const { close, fcntl } = fs
const { O_NONBLOCK, EAGAIN } = net.constants

const F_GETFL = 3
const F_SETFL = 4

const handle = dlopen('./libtailscale.so', 1)
assert(handle)

const api = {
  new: {
    result: 'i32',
    parameters: [],
    name: 'tailscale_new'
  },
  set_ephemeral: {
    result: 'i32',
    parameters: ['i32', 'i32'],
    name: 'tailscale_set_ephemeral'
  },
  up: {
    result: 'i32',
    parameters: ['i32'],
    name: 'tailscale_up'
  },
  close: {
    result: 'void',
    parameters: ['i32'],
    name: 'tailscale_close'
  },
  listen: {
    result: 'i32',
    parameters: ['i32', 'string', 'string', 'u32array'],
    name: 'tailscale_listen'
  },
  accept: {
    result: 'i32',
    parameters: ['i32', 'u32array'],
    name: 'tailscale_accept'
  }
}

const tailscale = {}
const u32 = new Uint32Array(2)

Object.keys(api).forEach(k => {
  const def = api[k]
  const sym = dlsym(handle, def.name || k)
  assert(sym)
  const fn = bind(sym, def.result, def.parameters)
  if (def.result === 'pointer') {
    tailscale[k] = spin.wrap(u32, fn, def.parameters.length)
  } else {
    tailscale[k] = fn
  }
})

function onSocketEvent (fd) {
  console.log('onSocketEvent')
}

function onConnect (sfd) {
  console.log('onConnect')
  const ch = new Uint32Array(2)
  assert(tailscale.accept(sfd, ch) === 0)
  const fd = ch[0]
  if (fd > 0) {
    setNonBlocking(fd)
    eventLoop.add(fd, onSocketEvent)
    return
  }
  if (spin.errno === EAGAIN) return
  close(fd)
}

const ts = tailscale.new()
assert(tailscale.set_ephemeral(ts, 1) === 0)
assert(tailscale.up(ts) === 0)
const lh = new Uint32Array(1)
assert(tailscale.listen(ts, 'tcp', ':1999', lh) === 0)
const eventLoop = new Loop()

function setNonBlocking (fd) {
  let flags = fcntl(fd, F_GETFL, 0)
  flags |= O_NONBLOCK
  assert(fcntl(fd, F_SETFL, flags) === 0)
}

setNonBlocking(lh[0])

assert(!eventLoop.add(lh[0], onConnect))

while (1) {
  spin.runMicroTasks()
  if (eventLoop.poll(-1) <= 0) break
}
