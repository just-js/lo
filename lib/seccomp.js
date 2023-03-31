const { seccomp } = spin.load('seccomp')

const { assert, utf8Decode } = spin

const EM_X86_64 = 62
const __AUDIT_ARCH_64BIT = 0x80000000
const __AUDIT_ARCH_LE = 0x40000000
const SCMP_ARCH_X86_64 = EM_X86_64 | __AUDIT_ARCH_64BIT | __AUDIT_ARCH_LE
const SYSCALL_NAME_MAX_LEN = 128

const seccomp_init = spin.wrap(seccomp.seccomp_init)
const seccomp_syscall_resolve_num_arch = spin.wrap(seccomp.seccomp_syscall_resolve_num_arch)
const {
  seccomp_rule_add_exact, seccomp_load, seccomp_release, 
  seccomp_syscall_resolve_name
} = seccomp

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

class Context {
  ctx = 0

  static getName (syscall_nr = 0) {
    const ptr = seccomp_syscall_resolve_num_arch(SCMP_ARCH_X86_64, syscall_nr)
    assert(ptr)
    return utf8Decode(ptr, -1)
  }

  static getNumber (syscall_name = '') {
    return seccomp_syscall_resolve_name(syscall_name)
  }

  init (defaultAction = SCMP_ACT_KILL_PROCESS) {
    const ctx = seccomp_init(defaultAction)
    assert(ctx)
    this.ctx = ctx
  }

  addRule (syscall_nr, perm = SCMP_ACT_ALLOW, action = SCMP_ACT_ALLOW) {
    assert(seccomp_rule_add_exact(this.ctx, syscall_nr, action, 0) === 0)
  }

  load () {
    assert(seccomp_load(this.ctx) === 0)
  }

  release () {
    seccomp_release(this.ctx)
  }
}

export { Context }
