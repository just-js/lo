import { system } from 'lib/system.js'

// cgroup v2 helpers (linux). plain functions over the cgroup2 filesystem:
// read and write control files, make and remove groups, move threads.
// errors throw with the file, the value and strerror.
//
// threads of one process can only be placed in different cgroups inside a
// "threaded" subtree: the process lives in a domain group (the threaded
// root) and its children are made threaded (set_threaded). only threaded
// controllers (cpu, cpuset, pids, perf_event) work there, not memory

const { core, ptr } = lo
const { open, close, pread, write_string, mkdir, rmdir, O_RDONLY, O_WRONLY, O_CLOEXEC } = core

const ROOT = '/sys/fs/cgroup'
const EEXIST = 17
const ENOENT = 2

const buf = ptr(new Uint8Array(4096))
const decoder = new TextDecoder()

// write one value to a control file (cgroup.procs, cpu.max, ...)
function write (path, value) {
  const fd = open(path, O_WRONLY | O_CLOEXEC, 0)
  if (fd < 0) throw new Error(`cgroup: open ${path}: ${system.strerror()}`)
  const str = String(value)
  const n = write_string(fd, str)
  const err = lo.errno
  close(fd)
  if (n !== str.length) {
    throw new Error(`cgroup: write ${JSON.stringify(str)} to ${path}: ${system.strerror(err)}`)
  }
}

// read a control file (they report size 0, so read_file doesn't work)
function read (path) {
  const fd = open(path, O_RDONLY | O_CLOEXEC, 0)
  if (fd < 0) throw new Error(`cgroup: open ${path}: ${system.strerror()}`)
  const n = pread(fd, buf.ptr, buf.length, 0)
  close(fd)
  if (n < 0) throw new Error(`cgroup: read ${path}: ${system.strerror()}`)
  return decoder.decode(buf.subarray(0, n)).trim()
}

// the controllers a group offers its children, e.g. ['cpuset', 'cpu']
function controllers (dir = ROOT) {
  return read(`${dir}/cgroup.controllers`).split(' ').filter(Boolean)
}

// true if cgroup2 is mounted at ROOT and offers all these controllers
function available (wanted = ['cpu', 'cpuset']) {
  try {
    const have = controllers(ROOT)
    return wanted.every(c => have.includes(c))
  } catch (err) {
    return false
  }
}

// enable controllers for a group's children, if not enabled already
function enable (dir, list) {
  const on = read(`${dir}/cgroup.subtree_control`).split(' ')
  const missing = list.filter(c => !on.includes(c))
  if (missing.length) write(`${dir}/cgroup.subtree_control`, missing.map(c => `+${c}`).join(' '))
}

// make a group; an existing one is reused
function make (dir) {
  if (mkdir(dir, 0o755) !== 0 && lo.errno !== EEXIST) {
    throw new Error(`cgroup: mkdir ${dir}: ${system.strerror()}`)
  }
  return dir
}

// remove a group (must have no threads and no child groups). false if it
// wasn't there
function remove (dir) {
  if (rmdir(dir) === 0) return true
  if (lo.errno === ENOENT) return false
  throw new Error(`cgroup: rmdir ${dir}: ${system.strerror()}`)
}

function set_threaded (dir) {
  if (read(`${dir}/cgroup.type`) !== 'threaded') write(`${dir}/cgroup.type`, 'threaded')
}

// move this whole process into a group
function move_process (dir, pid = core.getpid()) {
  write(`${dir}/cgroup.procs`, pid)
}

// move one thread (kernel tid) into a threaded group of its process's subtree
function move_thread (dir, tid) {
  write(`${dir}/cgroup.threads`, tid)
}

// cpu.max as a fraction of a cpu (2.5 = 2.5 cpus); 0 or Infinity = no limit
function set_cpu_max (dir, cpus, period = 100000) {
  const quota = (!cpus || cpus === Infinity) ? 'max' : Math.max(1000, Math.round(cpus * period))
  write(`${dir}/cpu.max`, `${quota} ${period}`)
}

// cpu.stat as numbers: usage_usec, user_usec, system_usec, nr_periods,
// nr_throttled, throttled_usec, ...
function cpu_stat (dir) {
  const stat = {}
  for (const line of read(`${dir}/cpu.stat`).split('\n')) {
    const [key, value] = line.split(' ')
    stat[key] = Number(value)
  }
  return stat
}

export {
  ROOT, read, write, controllers, available, enable, make, remove,
  set_threaded, move_process, move_thread, set_cpu_max, cpu_stat
}
