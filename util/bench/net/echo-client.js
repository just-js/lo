import { net } from 'lib/net.js'
import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'

const { system } = spin.load('system')
const { assert } = spin
const { AY, AD } = spin.colors
const {
  socket, connect, close, send, recv
} = net
const { 
  SOCK_STREAM, AF_INET, SOCK_NONBLOCK, SOCKADDR_LEN, O_NONBLOCK
} = net.constants
const { sockaddr_in } = net.types
const EAGAIN = 11
const EINPROGRESS = 115

const eb = new Uint8Array(1024)
const decoder = new TextDecoder()

function strerror (errnum = spin.errno) {
  const rc = system.strerror_r(errnum, eb, 1024)
  if (rc !== 0) return ''
  return decoder.decode(eb)
}

function onDrain (fd) {

}

function onSocketEvent (fd) {
  const bytes = recv(fd, u8, BUFSIZE, 0)
  if (bytes > 0) {
    stats.recv += bytes
    const written = send(fd, u8, bytes, 0)
    if (written === bytes) {
      stats.send += written
      return
    }
    if (written === -1) {
      if (spin.errno === EAGAIN) {
        console.log('send.EAGAIN')
        return
      }
      console.log('send.error')
      eventLoop.remove(fd)
      close(fd)
      return
    }
    assert(!eventLoop.modify(fd, Loop.Writable | Loop.EdgeTriggered, onDrain))
    return
  }
  if (bytes < 0 && spin.errno === EAGAIN) {
    console.log('recv.EAGAIN')
    return
  }
  console.log('recv.error')
  eventLoop.remove(fd)
  close(fd)
}

function onConnect (fd) {
  assert(!eventLoop.modify(fd, Loop.Readable, onSocketEvent))
  const written = send(fd, u8, BUFSIZE, 0)
  if (written === BUFSIZE) {
    stats.send += written
    return
  }
  if (written === -1) {
    if (spin.errno === EAGAIN) return
    eventLoop.remove(fd)
    close(fd)
    return
  }
  assert(!eventLoop.modify(fd, Loop.Writable | Loop.EdgeTriggered, onDrain))
}

const BUFSIZE = 65536
const u8 = new Uint8Array(BUFSIZE)
const address = '127.0.0.1'
const port = 3000

function client () {
  const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
  assert(fd !== -1)
  const rc = connect(fd, sockaddr_in(address, port), SOCKADDR_LEN)
  if (rc < 0 && spin.errno !== EINPROGRESS) throw new Error(`net.connect: ${strerror()}`)
  assert(!eventLoop.add(fd, onConnect, Loop.Writable | Loop.EdgeTriggered))
}

const eventLoop = new Loop()

const stats = {
  send: 0, recv: 0
}

function to_size_string (bytes) {
  if (bytes < 1000) {
    return `${bytes} Bps`
  } else if (bytes < 1000 * 1000) {
    return `${Math.floor((bytes / 1000) * 100) / 100} KBps`
  } else if (bytes < 1000 * 1000 * 1000) {
    return `${Math.floor((bytes / (1000 * 1000)) * 100) / 100} MBps`
  }
  return `${Math.floor((bytes / (1000 * 1000 * 1000)) * 100) / 100} GBps`
}

const timer = new Timer(eventLoop, 1000, () => {
  console.log(`${AY}send${AD} ${to_size_string(stats.send)} ${AY}recv${AD} ${to_size_string(stats.recv)}`)
  stats.send = stats.recv = 0
})

for (let i = 0; i < 512; i++) client()

while (1) {
  //spin.runMicroTasks()
  if (eventLoop.poll(-1) <= 0) break
}

timer.close()


/*
this is 1.64 times better throughput than bun and 0.2 times the memory usage
26 MB v 120 MB
4736079141 bytes each way versus 2887522707 bytes each way
38 duplex Gb/sec v 23 Gb

docker run -it --rm -v $(pwd):/bench --privileged benchy

nice -n 20 taskset --cpu-list 1 ./spin echo-server.js
nice -n 20 taskset --cpu-list 0 ./spin echo-client.js

nice -n 20 taskset --cpu-list 1 scratch/runtimes/bun bun-echo-server.js
nice -n 20 taskset --cpu-list 0 scratch/runtimes/bun bun-echo-client.js

this is mostly because we are not creating new buffers

*/