import { exec, mem, exec_path_env } from 'lib/proc.js'
import { stringify } from 'lib/stringify.js'
import { dump } from 'lib/binary.js'
import { control } from 'lib/ansi.js'

function mmio_signal (port_address) {
  const mem_fd = open('/dev/mem', O_RDWR | O_SYNC | O_CLOEXEC, 0)
  assert(mem_fd > 0)
  const page_size = getpagesize()
  const addr = mmap(0, page_size, PROT_WRITE, MAP_SHARED, mem_fd, port_address)
  const bytes = wrap_memory(addr, page_size)
  bytes[0] = 123
  munmap(addr, page_size)
  close(mem_fd)
}

function info () {
  console.log(
    ` ${AG}lo${AD}    ${version.lo} ${column(26)}${AG}v8${AD}    ${version.v8}
 ${AM}arch${AD}  ${arch} ${control.column(26)}${AM}os${AD}    ${os}
 ${AY}boot${AD}  ${boot_time} ms ${column(26)}${AY}rss${AD}   ${mem()}`)
}

async function handle_command (command) {
  if (!command) return
  if (command[0] === '!') {
    const [cmd, ...args] = command.slice(1).split(' ')
    exec(cmd, args)
    return
  }
  if (command === '.info') {
    info()
    return
  }
  const result = await async_fn.constructor(`return (${command})`)
    .call(this, command)
  if (result !== null && result !== undefined) {
    if (result === null) {
      console.log('<null>')
    } else if (result === undefined) { 
      console.log('<undefined>')
    } else if (!result.constructor) { 
      console.log(stringify(result))
    } else if (result.constructor.name === 'Number') {
      console.log(result)
    } else if (result.constructor.name === 'String') {
      console.log(`${result}`)
    } else if (ArrayBuffer.isView(result)) {
      const { buffer, byteOffset, length } = result
      console.log(dump(new Uint8Array(buffer, byteOffset, length)))
    } else {
      console.log(stringify(result))
    }
  }
}

async function repl () {
  const max_len = 65536
  info()
  const buffer = new Uint8Array(max_len)
  let n = 0
  const prompt = ptr(encoder.encode(`${AG}>${AD} \0`))
  write(1, prompt.ptr, prompt.length)
  while (true) {
    if (n === max_len) {
      console.log('line is too long')
      n = 0
      continue
    }
    const c = buffer[n++] = getchar()
    if (c === 0) break
    if (c === 10) {
      const command = decoder.decode(buffer.subarray(0, n)).trim()
      if (command === '.exit') break
      try {
        await handle_command(command)
      } catch (err) {
        handle_error(err)
      }
      n = 0
      write(1, prompt.ptr, prompt.length)
    }
  }
}

function logger (key) {
  const now = lo.hrtime()
  const ms = Math.floor((now - last) / 10000) / 100
  console.log(`${new Date().toISOString().slice(0, -1)}000000 ${key}: ${ms}`)
  last = now
}

function boot () {
  logger('boot')
  const FIRST_ADDR_PAST_32BITS = Math.pow(2, 32)
  const MEM_32BIT_GAP_SIZE = 768 << 20
  const _256MB = 256 * 1024 * 1024
  const PORT_ADDRESS = FIRST_ADDR_PAST_32BITS - MEM_32BIT_GAP_SIZE - _256MB // Firecracker 14
  mmio_signal(PORT_ADDRESS)
  assert(mount('proc', '/proc', 'proc', 0, 0) === 0)
  assert(mount('tmpfs', '/tmp', 'tmpfs', 0, 0) === 0)
  assert(mount('sysfs', '/sys', 'sysfs', 0, 0) === 0)
  assert(mount('devpts', '/dev/pts', 'devpts', 0, 0) === 0)
  logger('mount')
  assert(exec('/busybox', ['--install', '-s', '/bin'])[0] === 0)
  assert(exec('/busybox', ['ln', '-s', '/init', '/bin/lo'])[0] === 0)
  logger('busybox install')
  assert(exec('ip', ['addr', 'add', '172.16.0.2/30', 'dev', 'eth0'])[0] === 0)
  assert(exec('ip', ['link', 'set', 'eth0', 'up'])[0] === 0)
  assert(exec('ip', ['route', 'add', 'default', 'via', '172.16.0.1', 'dev', 'eth0'])[0] === 0)
  logger('eth0 link up')
  assert(exec('hostname', ['fire'])[0] === 0)
  logger('hostname set')
  const env = [
    'HOME=/root',
    'TERM=linux',
    'PWD=/root'
  ]
  write_file('/etc/passwd', encoder.encode('root:JQMuyS6H.AGMo:0:0:root:/root:/bin/sh'))
  write_file('/etc/shadow', encoder.encode('root::10933:0:99999:7:::'))
  write_file('/etc/profile', encoder.encode('export PS1=\'\\033[1;93m\\u\\033[0m@\\033[1;95m\\h\\033[0m:\\033[1;94m\\w\\033[0m\\$ \''))
  logger('root initialized')
  assert(mount('/dev/vda', '/root', 'ext4', 0, 0) === 0)
  logger('mounted root disk')
  assert(exec_path_env('/dropbear', [], env)[0] === 0)
  logger('sshd listening')
  chdir('/root')
  assert(exec_path_env('/busybox', ['sh', '-l'], env)[0] === 0)
  reboot(LINUX_REBOOT_CMD_RESTART)
}

const { 
  core, wrap_memory, assert, colors, version, handle_error, ptr 
} = lo
const { 
  open, O_RDWR, O_SYNC, O_CLOEXEC, getpagesize, mmap, PROT_WRITE, MAP_SHARED, 
  munmap, reboot, LINUX_REBOOT_CMD_RESTART, close, getpid, write,
  arch, os, getchar, write_file, chdir, mount
} = core
const { AG, AD, AY, AM } = colors
const { column } = control
const async_fn = Object.getPrototypeOf(async function() {})
const encoder = new TextEncoder()
const decoder = new TextDecoder()
let boot_time

globalThis.onUnhandledRejection = err => {
  console.error(err.stack)
}

globalThis.snapshotEntry = function () {
  let last = lo.start
  boot_time = Math.floor((lo.hrtime() - last) / 10000) / 100
  const { args } = lo
  if (getpid() === 1) {
    boot()
  } else {
    if (args[1] === 'repl') {
      repl().catch(lo.handle_error)
    } else if (args.length > 1) {
      import(args[1]).catch(lo.handle_error)
    } else  {

    }
  }
}
