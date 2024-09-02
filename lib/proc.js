const { ptr, core, assert } = lo

const { setenv } = core

const noop = () => {}

let mem = noop
let exec = noop
let exec_path_env = noop
let exec_env = noop
let make_args = noop
let cputime = noop

if (core.os === 'linux') {
  const { pread, open, O_RDONLY } = core

  function findmem (str) {
    const space = ' '
    let spaces = 0
    let last = 0
    while (spaces < 24) {
      const i = str.indexOf(space, last)
      if (i > 0) {
        if (spaces++ === 23) return (Number(str.slice(last, i)) * 4096)
        last = i + 1
      } else {
        break
      }
    }
  }

  const buf = ptr(new Uint8Array(1024))
  const decoder = new TextDecoder()
  let fd = 0
  mem = () => {
    if (fd === 0) fd = open(`/proc/self/stat`, O_RDONLY)
    if (pread(fd, buf, 1024, 0) > 0) return findmem(decoder.decode(buf))
    return 0
  }
} else if (core.os === 'mac') {
  const { mach } = lo.load('mach')
  const { ptr, assert } = lo
  const {
    struct_task_basic_info_size, struct_mach_msg_type_number_t_size,
    TASK_BASIC_INFO_COUNT, TASK_BASIC_INFO, KERN_SUCCESS,
    task_self, task_info
  } = mach
  const info = ptr(new Uint32Array(struct_task_basic_info_size / 4))
  const msg_type = ptr(new Uint32Array(struct_mach_msg_type_number_t_size / 4))
  msg_type[0] = TASK_BASIC_INFO_COUNT
  mem = () => {
    assert(task_info(task_self(), TASK_BASIC_INFO, info.ptr, msg_type.ptr) === KERN_SUCCESS)
    return info[3]
  }
}

if (core.os === 'linux' || core.os === 'mac') {

  const { fork, execvp, execve, waitpid, times, _SC_CLK_TCK, sysconf } = lo.core
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
      args: ptr(new Uint8Array(b64.buffer)),
      cstrings: argb
    }
  }

  exec = (name, vargs, status = new Int32Array(2)) => {
    const { args } = makeArgs([name, ...vargs])
    const pid = fork()
    if (pid === 0) {
      if (execvp(name, args) !== 0) {
        const err = new Error(`could not execvp ${lo.errno}`)
        console.error(err.message)
        console.error((new Error(``)).stack)
      }
//      lo.exit(1)
    } else if (pid > 0) {
      status[1] = waitpid(pid, status, 0)
      if (status[0] === 0) assert(status[1] === pid)
    } else {
      status[0] = lo.errno
      status[1] = pid
    }
    return status
  }

  exec_env = (name, vargs, env, status = new Int32Array(2)) => {
    const { args } = makeArgs([name, ...vargs])
    const pid = fork()
    if (pid === 0) {
      for (let i = 0; i < env.length; i++) {
        setenv(env[i][0], env[i][1])
      }
      if (execvp(name, args) !== 0) {
        const err = new Error(`could not execvp ${lo.errno}`)
        console.error(err.message)
        console.error((new Error(``)).stack)
      }
//      lo.exit(1)
    } else if (pid > 0) {
      status[1] = waitpid(pid, status, 0)
      if (status[0] === 0) assert(status[1] === pid)
    } else {
      status[0] = lo.errno
      status[1] = pid
    }
    return status
  }

  exec_path_env = (name, vargs, env, status = new Int32Array(2)) => {
    const { args } = makeArgs([name, ...vargs])
    const env_args = makeArgs(env).args
    const pid = fork()
    if (pid === 0) {
      if (execve(name, args, env_args) !== 0) {
        const err = new Error(`could not execve ${lo.errno}`)
        console.error(err.message)
        console.error((new Error(``)).stack)
      }
//      lo.exit(1)
    } else if (pid > 0) {
      status[1] = waitpid(pid, status, 0)
      if (status[0] === 0) assert(status[1] === pid)
    } else {
      status[0] = lo.errno
      status[1] = pid
    }
    return status
  }

  const clock_ticks_per_second = sysconf(_SC_CLK_TCK)
  const last = new Int32Array(6) 
  const current = new Int32Array(6) 
  current[5] = clock_ticks_per_second
  const time32 = new Uint32Array(7)

  cputime = () => {
    time32[4] = times(time32)
    for (let i = 0; i < 5; i++) {
      current[i] = time32[i] - last[i]
      last[i] = time32[i]
    }
    return current
  }

  make_args = makeArgs

}

export { mem, exec, exec_env, exec_path_env, make_args, cputime }
