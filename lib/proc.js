const { ptr, core, assert } = lo

const noop = () => {

}

let mem = noop
let exec = noop

if (core.os === 'linux') {
  const { pread, open, O_RDONLY } = core

  function findmem (str) {
    const space = ' '
    let spaces = 0
    let last = 0
    while (spaces < 24) {
      const i = str.indexOf(space, last)
      if (i > 0) {
        if (spaces++ === 23) return (Number(str.slice(last, i)) * 4096) / 1024
        last = i + 1
      } else {
        break
      }
    }
  }

  const buf = ptr(new Uint8Array(1024))
  const decoder = new TextDecoder()
  const fd = open(`/proc/self/stat`, O_RDONLY)
  mem = () => {
    if (pread(fd, buf, 1024, 0) > 0) return findmem(decoder.decode(buf))
    return 0
  }
}

if (core.os === 'linux' || core.os === 'mac') {

  const { fork, execvp, waitpid, exit } = lo.core
  const { cstr } = lo

  function makeArgs (args) {
    const argb = new Array(args.length)
    if (!args.length) return { args: new Uint8Array(0) }
    const b64 = new BigUint64Array(args.length + 1)
    for (let i = 0; i < args.length; i++) {
      const str = argb[i] = cstr(args[i])
      // @ts-ignore
      b64[i] = BigInt(str.ptr)
    }
    return {
      args: new Uint8Array(b64.buffer),
      cstrings: argb
    }
  }

  exec = (name, vargs, status) => {
    const { args } = makeArgs([name, ...vargs])
    const pid = fork()
    if (pid === 0) {
      const rc = execvp(name, args)
      lo.exit(1)
    } else if (pid > 0) {
      status[1] = waitpid(pid, status, 0)
      if (status[0] === 0) assert(status[1] === pid)
    } else {
      status[0] = lo.errno
      status[1] = pid
    }
  }

}

export { mem, exec }
