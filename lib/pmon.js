import { net } from 'lib/net.js'

const { core, cstr, ptr, assert, latin1Decode, hrtime } = lo
const {
  fork, execvp, execve, waitpid, WNOHANG,
  open, O_RDONLY, lseek, SEEK_SET, read, dup2, close, O_NONBLOCK, 
  O_CLOEXEC, write, STDIN, STDOUT, STDERR, chdir, kill, SIGTERM
} = core

function make_args (args) {
  const argb = new Array(args.length)
  if (!args.length) return { args: new Uint8Array(0) }
  const b64 = new BigUint64Array(args.length + 1)
  for (let i = 0; i < args.length; i++) {
    const str = argb[i] = cstr(args[i])
    // @ts-ignore
    b64[i] = BigInt(str.ptr)
  }
  return {
    args: ptr(new Uint8Array(b64.buffer)),
    cstrings: argb
  }
}

class Process {
  status = 0
  pid = 0
  error = 0
  buffer = ptr(new Uint8Array(4096))
  lastuser = 0
  lastsys = 0
  #utime = 0
  #stime = 0
  stdin = [0, 0]
  stdout = [0, 0]
  stderr = [0, 0]
  penv = undefined
  pargs = undefined
  cwd = undefined
  stats = []

  constructor (exe_path, vargs, venv) {
    this.exe_path = exe_path
    if (vargs) this.pargs = make_args([this.exe_path, ...vargs])
    if (venv) this.penv = make_args(venv)
  }

  set args (vargs) {
    this.pargs = make_args([this.exe_path, ...vargs])
  }

  set env (venv) {
    this.penv = make_args(venv)
  }

  run () {
    const { stdin, stdout, stderr } = this
    assert(net.pipe(stdin, O_NONBLOCK | O_CLOEXEC) === 0)
    assert(net.pipe(stdout, O_NONBLOCK | O_CLOEXEC) === 0)
    assert(net.pipe(stderr, O_NONBLOCK | O_CLOEXEC) === 0)
    const pid = fork()
    if (pid === 0) {
      dup2(stdin[READABLE], STDIN);
      dup2(stdout[WRITABLE], STDOUT);
      dup2(stderr[WRITABLE], STDERR);
      const { exe_path, pargs, penv } = this
      // we are in the child process
      if (this.cwd) chdir(this.cwd)
      if (penv) {
        execve(exe_path, pargs.args, penv.args)
      } else {
        execvp(exe_path, pargs.args)
      }
      lo.exit(1)
      return -1
    } else if (pid < 0) {
      this.error = lo.errno
      return pid
    }
    close(stdin[READABLE])
    close(stdout[WRITABLE])
    close(stderr[WRITABLE])
    this.pid = pid
    this.path = `/proc/${pid}/stat`
    this.fd = open(this.path, O_RDONLY)
    return pid
  }

  waitfor () {
    const { pid } = this
    const rc = waitpid(pid, stat, 0)
    if (rc > 0) {
      assert(rc === pid)
      this.status = stat[0]
    }
  }

  poll () {
    const { pid } = this
    this.#stats()
    const rc = waitpid(pid, stat, WNOHANG)
    if (rc > 0) {
      assert(rc === pid)
      this.status = stat[0]
      return 1
    }
    if (rc < 0) {
      this.error = lo.errno
      return rc
    }
    return 0
  }

  exit () {
    close(this.stdin[WRITABLE])
    close(this.stdout[READABLE])
    close(this.stderr[READABLE])
    close(this.fd)
    this.#utime = 0
    this.#stime = 0
    this.signal(9)
  }

  readout (buf, len = buf.length) {
    return read(this.stdout[READABLE], buf, len)
  }

  readerr (buf, len = buf.length) {
    return read(this.stderr[READABLE], buf, len)
  }

  writein (buf, len = buf.length) {
    return write(this.stdin[WRITABLE], buf, len)
  }

  draintext () {
    const buf = new Uint8Array(65536)
    let err = ''
    let out = ''
    let bytes = this.readerr(buf)
    while (bytes > 0) {
      err += decoder.decode(buf.subarray(0, bytes))
      bytes = this.readerr(buf)
    }
    bytes = this.readout(buf)
    while (bytes > 0) {
      out += decoder.decode(buf.subarray(0, bytes))
      bytes = this.readout(buf)
    }
    return { err, out }
  }

  dump () {
    const { err, out } = this.draintext()
    const stats = this.stats.slice(0)
    const time = hrtime()
    return { time, err, out, stats }
  }

  #stats () {
    if (this.fd <= 0) return
    const { fd, buffer } = this
    lseek(fd, 0, SEEK_SET)
    let bytes = read(fd, buffer, buffer.length)
    if (bytes <= 0) return
    const parts = []
    while (bytes > 0) {
      parts.push(latin1Decode(buffer.ptr, bytes))
      bytes = read(fd, buffer, buffer.length)
    }
    const fields = parts.join('').split(' ')
    this.comm = fields[1]
    this.state = fields[2]
    this.stats = fields.slice(3).map(v => Number(v))

    const utime = this.stats[10] - this.#utime
    this.#utime = this.stats[10]
    this.stats[10] = utime

    const stime = this.stats[11] - this.#stime
    this.#stime = this.stats[11]
    this.stats[11] = stime
  }

  get usr () {
    return this.stats[10]
  }

  get sys () {
    return this.stats[11]
  }

  get started () {
    return this.stats[18]
  }

  get cpu () {
    return this.stats[35]
  }

  get rss () {
    return this.stats[20] * 4096
  }

  signal (signum = SIGTERM) {
    return kill(this.pid, signum)
  }
}

/*
if (lo.core.os === 'linux') {
  const { getaffinity, setaffinity, struct_cpu_set_t_size } = core
  const cpu_set = ptr(new Uint8Array(struct_cpu_set_t_size))
  const cpu32 = new Uint32Array(cpu_set.buffer, 0, 1)

  set affinity (cpus) {
    // todo - make this fast in a for loop
    cpu32[0] = cpus.map(v => cpuids[v]).reduce((p, c) => p + c, 0)
    assert(setaffinity(this.pid, struct_cpu_set_t_size, cpu_set.ptr) === 0)
  }

  get affinity () {
    assert(getaffinity(this.pid, struct_cpu_set_t_size, cpu_set.ptr) === 0)
    const affinity = cpu32[0]
    const cpus = []
    cpuids.forEach((cpuid, i) => ((affinity & cpuid) === cpuid) && cpus.push(i))
    return cpus
  }


}

*/
const decoder = new TextDecoder()
const stat = new Int32Array(2)
const READABLE = 0
const WRITABLE = 1

//const cpus_online = sysconf(_SC_NPROCESSORS_ONLN)
//const clock_ticks = sysconf(_SC_CLK_TCK)
//const cpuids = (new Array(cpus_online)).fill(0).map((v, i) => Math.pow(2, i))

//TODO
/*
setsid
setgid
setuid
*/

//export { Process, cpus_online, cpuids, clock_ticks }
export { Process }
