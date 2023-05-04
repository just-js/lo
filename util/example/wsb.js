import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { WebSocket } from 'lib/websocket.js'

function createSocket () {
  const sock = new WebSocket(eventLoop)

  sock.onopen = () => {
    sock.send(msg)
    send++
  }

  sock.onmessage = len => {
    recv++
    sock.send(msg)
    send++
  }

  sock.connect()
  return sock
}

function onTimer () {
  console.log(`send ${send} recv ${recv}`)
  send = recv = 0
}

let send = 0
let recv = 0
const eventLoop = new Loop()
const msg = WebSocket.createMessage(1024)
const timer = new Timer(eventLoop, 1000, onTimer)
const sockets = []

for (let i = 0; i < 16; i++) {
  sockets.push(createSocket())
}

while (1) {
  spin.runMicroTasks()
  eventLoop.poll(-1)
}

timer.close()
