import { Loop } from 'lib/loop.js'
import { Socket } from 'lib/socket.js'
import { Timer } from 'lib/timer.js'

const { AY, AD } = spin.colors

const eventLoop = new Loop()

const BUFSIZE = 65536
const u8 = new Uint8Array(BUFSIZE)

const stats = {
  send: 0, recv: 0, conn: 0
}

async function client () {
  const sock = new Socket(eventLoop)
  await sock.connect()
  stats.conn++
  while (1) {
    const written = await sock.send(u8)
    if (written === 0) break
    stats.send += written
    const bytes = await sock.recv(u8)
    if (bytes === 0) break
    stats.recv += bytes
  }
  stats.conn--
  sock.close()
}

for (let i = 0; i < 8; i++) client()

const timer = new Timer(eventLoop, 1000, () => {
  console.log(`${AY}send${AD} ${stats.send} ${AY}recv${AD} ${stats.recv}`)
  stats.send = stats.recv = 0
})

while (1) {
  spin.runMicroTasks()
  if (eventLoop.poll(-1) <= 0) break
}

timer.close()
