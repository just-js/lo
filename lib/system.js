const { system } = lo.load('system')

const { cstr, ptr } = lo
const { sysconf, _SC_CLK_TCK } = system

//const { wrap } = lo

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

function wrapStrError () {
  const eb = new Uint8Array(1024)
  const { strerror_r } = system
  system.strerror = (errnum = lo.errno) => {
    const rc = strerror_r(errnum, eb, 1024)
    if (rc !== 0) return
    return `${errnum}: ${decoder.decode(eb)}`
  }
}

function wrapCPUTime () {
  const cpu32 = new Uint32Array(9)
  system.cputime = () => {
    cpu32[4] = system.times(cpu32)
    return cpu32
  }
}

class SystemError extends Error {
  constructor (name) {
    const { errno } = lo
    super(`${name} ${system.strerror(errno)}`)
    this.errno = errno
    this.name = 'SystemError'
  }
}

/*
const sys_assert = (...args) => {
  return lo.assert(...[...args, err => console.log(`errno ${lo.errno}\n${strerror()}\n${err.stack}`)]) 
}
*/

system.clock_ticks_per_second = sysconf(_SC_CLK_TCK)
const decoder = new TextDecoder()
system.SystemError = SystemError
wrapStrError()
wrapCPUTime()

export { system, make_args }
