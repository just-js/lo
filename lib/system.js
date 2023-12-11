const { system } = lo.load('system')

const decoder = new TextDecoder()

function wrapStrError () {
  const eb = new Uint8Array(1024)
  const { strerror_r } = system
  system.strerror = (errnum = lo.errno) => {
    const rc = strerror_r(errnum, eb, 1024)
    if (rc !== 0) return
    return decoder.decode(eb)
  }
}

wrapStrError()

export { system }
