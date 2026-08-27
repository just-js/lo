import { exec, mem, exec_path_env } from 'lib/proc.js'
import { stringify } from 'lib/stringify.js'
import { dump } from 'lib/binary.js'
import { control } from 'lib/ansi.js'
import { Bench } from 'lib/bench.js'

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

async function sqlite_bench () {
  const OK = 0
  const ROW = 100
  const OPEN_CREATE = 0x00000004
  const OPEN_READWRITE = 0x00000002
  const OPEN_NOMUTEX = 0x00008000
  const flags = OPEN_CREATE | OPEN_READWRITE | OPEN_NOMUTEX

  const u32 = ptr(new Uint32Array(2))
  assert(open2(':memory:', u32.ptr, flags, 0) === OK)
  const db = u32[0] + ((2 ** 32) * u32[1])

  assert(exec2(db, 'PRAGMA auto_vacuum = none', 0, 0, u32.ptr) === OK)
  assert(exec2(db, 'PRAGMA temp_store = memory', 0, 0, u32.ptr) === OK)
  assert(exec2(db, 'PRAGMA locking_mode = exclusive', 0, 0, u32.ptr) === OK)
  assert(exec2(db, 'pragma user_version = 100', 0, 0, u32.ptr) === OK)
  const sql = 'pragma user_version'
  assert(prepare2(db, sql, utf8_length(sql), u32.ptr, 0) === OK)
  const stmt = u32[0] + ((2 ** 32) * u32[1])

  function get_version (stmt) {
    if(step(stmt) === ROW) {
      const v = column_int(stmt, 0)
      reset(stmt)
      return v
    }
    finalize(stmt)
    return 0
  }

  assert(get_version(stmt) === 100)

  const runs = 15000000
  const iter = 10
  const bench = new Bench()

  const name = 'user_version'
  bench.name_width = name.length

  for (let i = 0; i < iter; i++) {
    bench.start(name)
    for (let j = 0; j < runs; j++) {
      assert(get_version(stmt) === 100)
    }
    bench.end(runs)
  }

  finalize(stmt)
  close2(db)
}

function vsock_client () {
  const AF_VSOCK = 40
  const SOCKADDR_LEN = 16
  const VMADDR_CID_HOST = 2
  const VSOCK_PORT = 5000

  function sockaddr_vsock () {
    const buf = new ArrayBuffer(SOCKADDR_LEN)
    const dv = new DataView(buf)
    dv.setUint16(0, AF_VSOCK, true)
    dv.setUint32(4, VSOCK_PORT, true)
    dv.setUint32(8, VMADDR_CID_HOST, true)
    return ptr(new Uint8Array(buf))
  }

  const addr = sockaddr_vsock()
  const fd = assert(socket(AF_VSOCK, SOCK_STREAM, 0))
  assert(connect(fd, addr.ptr, SOCKADDR_LEN) === 0)
  const BUFSIZE = 256 * 1024;
  const buf = ptr(new Uint8Array(BUFSIZE))
  let written = write(fd, buf.ptr, buf.length)
  while (written > 0) {
    const bytes = read(fd, buf.ptr, buf.length)
    if (bytes < 0) break
    written = write(fd, buf.ptr, bytes)
  }
  close(fd)
}

function vsock_listen () {
  const AF_VSOCK = 40
  const SOCKADDR_LEN = 16
  const VMADDR_CID_HYPERVISOR = 0
  const VMADDR_CID_ANY = -1
  const VSOCK_PORT = 5000

  function sockaddr_vsock () {
    const buf = new ArrayBuffer(SOCKADDR_LEN)
    const dv = new DataView(buf)
    dv.setUint16(0, AF_VSOCK, true)
    dv.setUint32(4, VSOCK_PORT, true)
    dv.setUint32(8, VMADDR_CID_ANY, true)
    return ptr(new Uint8Array(buf))
  }
  const addr = sockaddr_vsock()
  const fd = assert(socket(AF_VSOCK, SOCK_STREAM, 0))
  assert(bind(fd, addr.ptr, SOCKADDR_LEN) === 0)
  assert(listen(fd, 128) === 0)
  console.log('listening')
//  const peer_addr = ptr(new ArrayBuffer(SOCKADDR_LEN))
//  const peer_addr_len = ptr(new Uint32Array(2))
//  peer_addr_len[0] = SOCKADDR_LEN
//  const cfd = accept(fd, peer_addr.ptr, peer_addr_len.ptr)
  const cfd = accept(fd, 0, 0)
  console.log(`connection received ${cfd}`)
  const BUFSIZE = 256 * 1024;
  const buf = ptr(new Uint8Array(BUFSIZE))
  const encoder = new TextEncoder()
  const bb = ptr(encoder.encode('hello\n'))
  for (let i = 0; i < 10; i++) {
    const written = write(fd, bb.ptr, bb.length)
    console.log(written)
    console.log(lo.errno)
    lo.core.sleep(1)
  }

  let bytes = read(fd, buf.ptr, buf.length)
  console.log(bytes)
  while (bytes > 0) {
    const written = write(fd, buf.ptr, bytes)
    if (written < 0) break
    bytes = read(fd, buf.ptr, buf.length)
    console.log(bytes)
  }
  console.log(lo.errno)
  console.log('closing')
  close(cfd)
  close(fd)
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
  if (command === '.sqlite') {
    await sqlite_bench()
    return
  }
  if (command === '.vsock_listen') {
    await vsock_listen()
    return
  }
  if (command === '.vsock_client') {
    await vsock_client()
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
  //const PORT_ADDRESS = FIRST_ADDR_PAST_32BITS - MEM_32BIT_GAP_SIZE // firecracker <=12.1
  const PORT_ADDRESS = FIRST_ADDR_PAST_32BITS - MEM_32BIT_GAP_SIZE - _256MB // Firecracker 14
  mmio_signal(PORT_ADDRESS)
//  assert(mount('devtmpfs', '/dev', 'devtmpfs', 0, 0) === 0)
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
/*
  write_file('/etc/config/dropbear', encoder.encode(`# uci show dropbear
dropbear.@dropbear[0]=dropbear
dropbear.@dropbear[0].RootPasswordAuth='0'
dropbear.@dropbear[0].PasswordAuth='0'
dropbear.@dropbear[0].Port='22'`))
*/
  logger('root initialized')

  assert(mount('/dev/vda', '/root', 'ext4', 0, 0) === 0)
  logger('mounted root disk')

  assert(exec_path_env('/dropbear', [], env)[0] === 0)
//  assert(exec_path_env('/dropbear', ['-R', '-B'], env)[0] === 0)
  logger('sshd listening')
  chdir('/root')
  assert(exec_path_env('/busybox', ['sh', '-l'], env)[0] === 0)
  reboot(LINUX_REBOOT_CMD_RESTART)
}

const { 
  core, wrap_memory, assert, colors, load, args, version, handle_error, 
  utf8_length, ptr 
} = lo
const { 
  open, O_RDWR, O_SYNC, O_CLOEXEC, getpagesize, mmap, PROT_WRITE, MAP_SHARED, 
  munmap, reboot, LINUX_REBOOT_CMD_RESTART, close, getpid, write, read,
  arch, os, getchar, write_file, chdir, mount
} = core
const { sqlite } = load('sqlite')
const { net } = lo.load('net')
const { AG, AD, AY, AM } = colors
const { column } = control
const {
  step, column_int, reset, finalize, open2, exec2 = exec, close2, prepare2
} = sqlite
const { socket, bind, listen, accept, connect, SOCK_STREAM } = net
const async_fn = Object.getPrototypeOf(async function() {})
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const prompt = ptr(encoder.encode(`${AG}>${AD} \0`))
let last = lo.start
const boot_time = Math.floor((lo.hrtime() - last) / 10000) / 100

globalThis.onUnhandledRejection = err => {
  console.error(err.stack)
}

if (getpid() === 1) {
  boot()
} else {
  if (args[1] === 'repl') {
    await repl()
  } else {
    await import(args[1])
  }
}
