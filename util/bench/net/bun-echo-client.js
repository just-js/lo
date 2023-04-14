import { connect } from "bun";

const BUFSIZE = 65536;
const msg = new ArrayBuffer(BUFSIZE);

const handlers = {
  open(socket) {
    if (!socket.write(msg)) {
      socket.data = { pending: msg };
      return;
    }
    stats.send += BUFSIZE;
  },
  data(socket, buffer) {
    const len = buffer.byteLength;
    stats.recv += len;
    if (!socket.write(buffer)) {
      socket.data = { pending: buffer };
      return;
    }
    stats.send += len;
  },
  drain(socket) {
    const pending = socket.data?.pending;
    if (!pending) return;
    if (socket.write(pending)) {
      stats.send += pending.byteLength;
      socket.data = undefined;
      return;
    }
  },
};

const stats = {
  send: 0, recv: 0
};

setInterval(() => {
  console.log("send", stats.send, "recv", stats.recv);
  stats.send = stats.recv = 0;
}, 1000);

for (let i = 0; i < 8; i++) {
  await connect({
    socket: handlers,
    hostname: "localhost",
    port: 3000,
  });
}
