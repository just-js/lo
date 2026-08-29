#!/root/.lo/bin/lo
import { bind_custom } from 'lib/ffi.js'
import { asm, compiler, Registers } from 'lib/asm.js'
import { make_args } from 'lib/proc.js'

const { core, assert, ptr, colors } = lo
const { dlsym, RTLD_DEFAULT, defaultWriteMode, defaultWriteFlags, open, STDOUT } = core
const { rdi, rsi, rdx, rcx, rbx, rax, rsp } = Registers
const { AD, AY, AG, AR, AM, AC } = colors

function bind_execve () {
  const fast_addr = compiler.compile(asm.reset()
    .call(vfork_sym)
    .cmp(rax, 0)
    .jel('child')
    .cmp(rax, -1)
    .jel('ret')
    .movreg(rax, rdi)
    .movabs(status_buf.ptr, rsi)
    .movabs(0, rdx)
    .movabs(rusage.ptr, rcx)
    .jmp(wait4_sym)
    .label('ret')
    .ret()
    .label('child')

    .movabs(fd, rdi)
    .movabs(STDOUT, rsi)
    .call(dup2_sym)

    .movabs(exe_buf.ptr, rdi)
    .movabs(args_buf.args.ptr, rsi)
    .movabs(envp, rdx)
    .call(execve_sym)
    .movreg(rax, rdi)
    .jmp(exit_sym)
  .bytes())

  const slow_addr = compiler.compile(asm.reset()
    .sub(rsp, 8)
    .push(rbx)
    .movreg(rdi, rbx)
    .call(vfork_sym)
    .cmp(rax, 0)
    .jel('child')
    .cmp(rax, -1)
    .jel('ret')
    .movreg(rax, rdi)
    .movabs(status_buf.ptr, rsi)
    .movabs(0, rdx)
    .movabs(rusage.ptr, rcx)
    .call(wait4_sym)
    .label('ret')
    .movdest(rax, rbx, 0)
    .pop(rbx)
    .add(rsp, 8)
    .ret()
    .label('child')

    .movabs(fd, rdi)
    .movabs(STDOUT, rsi)
    .call(dup2_sym)

    .movabs(exe_buf.ptr, rdi)
    .movabs(args_buf.args.ptr, rsi)
    .movabs(envp, rdx)
    .call(execve_sym)
    .movreg(rax, rdi)
    .jmp(exit_sym)
  .bytes())

  return bind_custom('i32', [], slow_addr, fast_addr)
}

const args = lo.args.slice(1)

const fd = open('/dev/null', defaultWriteFlags, defaultWriteMode)
assert(fd > 2)

const exe_path = args[0] || './true'
const execve_sym = assert(dlsym(RTLD_DEFAULT, 'execve'))
const vfork_sym = assert(dlsym(RTLD_DEFAULT, 'vfork'))
const wait4_sym = assert(dlsym(RTLD_DEFAULT, 'wait4'))
const exit_sym = assert(dlsym(RTLD_DEFAULT, 'exit'))
const dup2_sym = assert(dlsym(RTLD_DEFAULT, 'dup2'))
const encoder = new TextEncoder()
const exe_buf = ptr(encoder.encode(`${exe_path}\0`))
const status_buf = ptr(new Uint32Array(1))
const args_buf = make_args(args)
const envp = lo.environ()

const rusage = ptr(new Uint8Array(1024))
const dv = new DataView(rusage.buffer)

/*

// struct rusage layout (x86_64 Linux): two 16-byte timevals, then
// fourteen 8-byte longs. ru_ixrss/idrss/isrss/nswap/msgsnd/msgrcv/
// nsignals are marked unmaintained on Linux (always 0) - see `man 2
// getrusage` - so they're skipped here, not overlooked.
function readRusage (u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  const l = (off) => Number(dv.getBigInt64(off, true))
  return {
    utime_us: l(0) * 1e6 + l(8),    // ru_utime: user CPU time
    stime_us: l(16) * 1e6 + l(24),  // ru_stime: system CPU time
    maxrss: l(32),                  // ru_maxrss: peak RSS, KB
    minflt: l(64),                  // ru_minflt: soft page faults
    majflt: l(72),                  // ru_majflt: hard page faults
    inblock: l(88),                 // ru_inblock: block input ops
    oublock: l(96),                 // ru_oublock: block output ops
    nvcsw: l(128),                  // ru_nvcsw: voluntary ctx switches
    nivcsw: l(136)                  // ru_nivcsw: involuntary ctx switches
  }
}

*/

const vexecve = bind_execve()
let max_rss = 0

function run () {
  const rc = vexecve()
  const m = dv.getUint32(32, true)
  if (m > max_rss) max_rss = m
  assert(rc > 0)
}

assert(vexecve() > 0)

const RUNS = lo.getenv('RUNS') || 100
const ITER = lo.getenv('ITER') || 10
const runs = parseInt(RUNS, 10)
const iter = parseInt(ITER, 10)

for (let i = 0; i < iter; i++) {
  const then = lo.hrtime()
  for (let j = 0; j < runs; j++) run()
  const nanos = lo.hrtime() - then
  const nanos_iter = Math.floor(nanos / runs)
  console.log(`${AY}nanos${AD} ${nanos_iter} ${AG}max_rss${AD} ${max_rss}`)
  max_rss = 0
}
