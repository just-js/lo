import { mem, cputime } from 'lib/proc.js'

const { colors } = lo
const { AY, AC, AD, AM } = colors

function to_size_string(bytes) {
  if (bytes < 1000) {
    return `${bytes.toFixed(2).padStart(8, " ")} ${AY} Bps${AD}`;
  } else if (bytes < 1000 * 1000) {
    return `${(Math.floor((bytes / 1000) * 100) / 100).toFixed(2).padStart(8, " ")} ${AY}KBps${AD}`;
  } else if (bytes < 1000 * 1000 * 1000) {
    return `${(Math.floor((bytes / (1000 * 1000)) * 100) / 100).toFixed(2).padStart(8, " ")} ${AY}MBps${AD}`;
  }
  return `${(Math.floor((bytes / (1000 * 1000 * 1000)) * 100) / 100).toFixed(2).padStart(8, " ")} ${AY}GBps${AD}`;
}

class Stats {
  recv = 0;
  send = 0;
  conn = 0;
  rps = 0;

  log() {
    const { send, recv, conn, rps } = this;
    const [usr, , sys] = cputime();
    const rps_core = Math.floor(rps / ((usr + sys) / 100)) || 0;
    console.log(
      `${AC}send${AD} ${to_size_string(send)} ${AC}recv${AD} ${to_size_string(recv)} ${AC}rps${AD} ${rps.toString().padStart(8, " ")} ${AM}rps/core${AD} ${rps_core.toString().padStart(8, " ")} ${AC}rss${AD} ${mem()} ${AC}con${AD} ${conn} ${AY}usr${AD} ${Math.round(usr, 0).toString().padStart(3, " ")} ${AY}sys${AD}  ${Math.round(sys, 0).toString().padStart(3, " ")} ${AY}tot${AD} ${Math.round(usr + sys, 0).toString().padStart(3, " ")}`,
    );
    this.send = this.recv = this.rps = 0;
  }

  get runtime() {
    return lo.hrtime() - lo.start;
  }
}

export { Stats }
