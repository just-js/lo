import { system } from 'lib/system.js'

const { cstr } = spin
const WNOHANG = 1
const SIGTERM = 15

function makeArgs (args) {
  const argb = new Array(args.length)
  if (!args.length) return new Uint8Array(0)
  const b64 = new BigUint64Array(args.length + 1)
  for (let i = 0; i < args.length; i++) {
    const str = argb[i] = cstr(args[i])
    b64[i] = BigInt(str.ptr)
  }
  return {
    args: new Uint8Array(b64.buffer),
    cstrings: argb
  }
}

const [name, ...vargs] = spin.args.slice(2)
const wait_ms = 1000

function spawn () {
  const { args } = makeArgs([name, ...vargs])
  const pid = system.fork()
  if (pid === 0) {
    const rc = system.execvp(name, args)
    console.log(`error launching ${rc}`)
    system.exit(1)
  } else if (pid > 0) {
    console.log(`launch ${pid}`)
    const status = new Uint8Array(4)
    const rc = system.waitpid(pid, status, 0)
    console.log(`wait ${rc} status ${status[0]}`)
  } else {
    console.log(spin.errno)
  }
  system.usleep(wait_ms * 1000)
  spin.nextTick(spawn)
}

spawn()
