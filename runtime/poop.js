import { bind_custom } from 'lib/ffi.js'
import { asm, compiler, Registers } from 'lib/asm.js'
import { make_args } from 'lib/proc.js'

const { core, assert, ptr, colors } = lo
const { 
  dlsym, RTLD_DEFAULT, defaultWriteMode, defaultWriteFlags, open, STDOUT, 
  memfd_create, read_file, write 
} = core
const { rdi, rsi, rdx, rbx, rax, rsp } = Registers
const { AM, AD } = colors

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
    .jmp(waitpid_sym)
    .label('ret')
    .ret()
    .label('child')

    .movabs(fd, rdi)
    .movabs(STDOUT, rsi)
    .call(dup2_sym)

    .movabs(fd_exe, rdi)
    .movabs(args_buf.ptr, rsi)
    .movabs(0, rdx)
    .call(fexecve_sym)
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
    .call(waitpid_sym)
    .label('ret')
    .movdest(rax, rbx, 0) 
    .pop(rbx)
    .add(rsp, 8)
    .ret()
    .label('child')

    .movabs(fd, rdi)
    .movabs(STDOUT, rsi)
    .call(dup2_sym)

    .movabs(fd_exe, rdi)
    .movabs(args_buf.ptr, rsi)
    .movabs(0, rdx)
    .call(fexecve_sym)
    .movreg(rax, rdi)
    .jmp(exit_sym)
  .bytes())

  return bind_custom('i32', [], slow_addr, fast_addr)
}

const args = lo.args.slice(1)

const fd = open('/dev/null', defaultWriteFlags, defaultWriteMode)
assert(fd > 2)

const exe_path = args[0] || './true'
const fd_exe = memfd_create(exe_path, 0)
const bytes = read_file(exe_path)
assert(write(fd_exe, bytes.ptr, bytes.length) === bytes.length)

const fexecve_sym = assert(dlsym(RTLD_DEFAULT, 'fexecve'))
const vfork_sym = assert(dlsym(RTLD_DEFAULT, 'vfork'))
const waitpid_sym = assert(dlsym(RTLD_DEFAULT, 'waitpid'))
const exit_sym = assert(dlsym(RTLD_DEFAULT, 'exit'))
const dup2_sym = assert(dlsym(RTLD_DEFAULT, 'dup2'))
const status_buf = ptr(new Uint32Array(1))
const args_buf = args.length > 1 ? make_args(args.slice(1)).args : ptr(new Uint8Array(8))
const vexecve = bind_execve()

function exec () {
  assert(vexecve() > 0)
  assert(status_buf[0] === 0)
}

const RUNS = lo.getenv('RUNS')
const runs = parseInt(RUNS || 100, 10)

for (let i = 0; i < 20; i++) {
  const start = Date.now()
  for (let j = 0; j < runs; j++) exec()
  const elapsed = Date.now() - start
  const rate = Math.floor(runs / (elapsed / 1000))
  const ns_iter = Math.floor(1e9 / rate)
  console.log(`${AM}rate${AD} ${rate} ${AM}ns_iter${AD} ${ns_iter}`)
}
