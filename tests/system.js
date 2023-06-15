import { system } from 'lib/system.js'

const { assert, fs } = spin

const pid = system.getpid()
assert(pid.constructor.name === 'Number' && pid > 0)
const fd = system.pidfd_open(pid)
assert(fd.constructor.name === 'Number' && fd > 2)
assert(fs.close(fd) === 0)
const proccwd = system.readlink('/proc/self/cwd')
assert(proccwd.constructor.name === 'String' && proccwd.length)
const cwd = system.getcwd()
assert(cwd.constructor.name === 'String' && cwd.length)
assert(cwd === proccwd)
assert(cwd.localeCompare(proccwd) === 0)
const limits = system.getrlimit().map(v => v * 2)
console.log(limits)
console.log(system.getrlimit())
console.log(system.setrlimit(1024, 1024))
console.log(system.getrlimit())
console.log(system.setrlimit(256, 256))
console.log(system.getrlimit())
