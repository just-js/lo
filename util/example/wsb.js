import { Loop } from 'lib/loop.js'
import { Timer } from 'lib/timer.js'
import { WebSocket } from 'lib/websocket.js'

function createSocket (port = 3000, address = '127.0.0.1') {
  const sock = new WebSocket(eventLoop, port, address)

  sock.onopen = () => {
    console.log('open')
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
const msg = WebSocket.createMessage(100, 0)
const timer = new Timer(eventLoop, 1000, onTimer)
const sockets = []
const numClients = 1

for (let i = 0; i < numClients; i++) {
  sockets.push(createSocket(3000))
}

while (1) {
  spin.runMicroTasks()
  eventLoop.poll(-1)
}

timer.close()
