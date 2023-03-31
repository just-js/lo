import { Library } from 'lib/ffi.js'

const { assert, utf8Decode } = spin

const seccomp = (new Library()).open('libseccomp.so').bind({
  seccomp_syscall_resolve_num_arch: {
    parameters: ['i32', 'i32'],
    result: 'pointer',
    rpointer: 'const char*'
  },
  seccomp_init: {
    parameters: ['u32'],
    result: 'pointer',
    rpointer: 'scmp_filter_ctx'
  },
  seccomp_rule_add_exact: {
    parameters: ['pointer', 'u32', 'i32', 'u32'],
    pointers: ['scmp_filter_ctx'],
    result: 'i32'
  },
  seccomp_load: {
    parameters: ['pointer'],
    pointers: ['scmp_filter_ctx'],
    result: 'i32'
  },
  seccomp_release: {
    parameters: ['pointer'],
    pointers: ['scmp_filter_ctx'],
    result: 'void'
  },
  seccomp_syscall_resolve_name: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32'
  }
})

const EM_X86_64 = 62
const __AUDIT_ARCH_64BIT = 0x80000000
const __AUDIT_ARCH_LE = 0x40000000
const SCMP_ARCH_X86_64 = EM_X86_64 | __AUDIT_ARCH_64BIT | __AUDIT_ARCH_LE
const SYSCALL_NAME_MAX_LEN = 128

/*
 * seccomp actions
 */

/**
 * Kill the process
 */
const SCMP_ACT_KILL_PROCESS	= 0x80000000
/**
 * Kill the thread
 */
const SCMP_ACT_KILL_THREAD = 0x00000000
/**
 * Kill the thread, defined for backward compatibility
 */
const SCMP_ACT_KILL = SCMP_ACT_KILL_THREAD
/**
 * Throw a SIGSYS signal
 */
const SCMP_ACT_TRAP = 0x00030000
/**
 * Notifies userspace
 */
const SCMP_ACT_NOTIFY = 0x7fc00000
/**
 * Return the specified error code
 */
const SCMP_ACT_ERRNO = (x) => (0x00050000 | ((x) & 0x0000ffff))
/**
 * Notify a tracing process with the specified value
 */
const SCMP_ACT_TRACE = (x) => (0x7ff00000 | ((x) & 0x0000ffff))
/**
 * Allow the syscall to be executed after the action has been logged
 */
const SCMP_ACT_LOG = 0x7ffc0000
/**
 * Allow the syscall to be executed
 */
const SCMP_ACT_ALLOW = 0x7fff0000


/*
const handle = spin.dlopen('libseccomp.so', 1)
const v = spin.dlsym(handle, 'SCMP_ARCH_X86_64')
console.log(v)
*/

let i = 0
let ptr = seccomp.seccomp_syscall_resolve_num_arch(SCMP_ARCH_X86_64, i)
while (ptr) {
  const name = utf8Decode(ptr, -1)
  const syscall_nr = seccomp.seccomp_syscall_resolve_name(name)
  console.log(`${i} : ${name}, ${syscall_nr}`)
  assert(i === syscall_nr)
  i++
  ptr = seccomp.seccomp_syscall_resolve_num_arch(SCMP_ARCH_X86_64, i)
}
