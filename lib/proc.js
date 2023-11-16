const { ptr, core } = lo

let mem = () => 0

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

export { mem }
