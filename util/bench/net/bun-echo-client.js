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

const stats = {
  send: 0, recv: 0
};

setInterval(() => {
  console.log("send", to_size_string(stats.send), "recv", to_size_string(stats.recv));
  stats.send = stats.recv = 0;
}, 1000);

for (let i = 0; i < 512; i++) {
  await connect({
    socket: handlers,
    hostname: "localhost",
    port: 3000,
  });
}
