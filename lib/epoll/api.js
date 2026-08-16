const api = {
  create: {
    parameters: ['i32'],
    result: 'i32',
    name: 'epoll_create1'
  },
  modify: {
    parameters: ['i32', 'i32', 'i32', 'buffer'],
    pointers: [, , , 'struct epoll_event *'],
    result: 'i32',
    name: 'epoll_ctl'
  },
  wait: {
    parameters: ['i32', 'buffer', 'i32', 'i32'],
    pointers: [, 'struct epoll_event *'],
    result: 'i32',
    name: 'epoll_wait'
  },
  pwait: {
    parameters: ['i32', 'buffer', 'i32', 'i32', 'buffer'],
    pointers: [, 'struct epoll_event *', , ,'const sigset_t*'],
    result: 'i32',
    name: 'epoll_pwait'
  },
  pwait2: {
    parameters: ['i32', 'pointer', 'i32', 'pointer', 'pointer'],
    pointers: [, 'struct epoll_event *', ,'const struct timespec *', 'const sigset_t*'],
    result: 'i32',
    name: 'epoll_pwait2'
  },
  close: {
    parameters: ['i32'],
    result: 'i32',
  },
  prctl: {
    parameters: ['i32', 'u32'],
    result: 'i32',
  }
}

const constants = {
  EPOLLIN: 'i32',
  EPOLLOUT: 'i32',
  EPOLLERR: 'i32',
  EPOLLHUP: 'i32',
  EPOLL_CLOEXEC: 'i32',
  EPOLLEXCLUSIVE: 'i32',
  EPOLLWAKEUP: 'i32',
  EPOLLONESHOT: 'i32',
  EPOLLET: 'i32',
  EPOLL_CTL_ADD: 'i32',
  EPOLL_CTL_DEL: 'i32',
  EPOLL_CTL_MOD: 'i32',
  EAGAIN: 'i32',
  PR_SET_TIMERSLACK: 'i32',
}

const includes = ['sys/epoll.h', 'unistd.h', 'sys/prctl.h']
const structs = ['epoll_event']
const name = 'epoll'

// musl has no epoll_pwait2() libc wrapper at all (unlike core.cc's *64
// names, which musl aliases via headers under _LARGEFILE64_SOURCE) - call
// the raw syscall directly instead, same signature glibc's own wrapper
// uses. Gated behind MUSL rather than always on, since a real libc
// epoll_pwait2() exists everywhere else this binding builds. Also
// double-guarded with #ifndef __GLIBC__ (which musl never defines) at
// the C level, not just here at generation time - this same preamble
// also ships baked into a committed, non-regenerated lib/epoll/epoll.cc
// for the top-level Makefile's own build, so it needs to stay correct
// even if MUSL was set wrong (or not at all) whenever that file was last
// generated. See LO-MUSL.md.
const MUSL = lo.getenv('MUSL') === '1'
const preamble = MUSL ? `
#ifndef __GLIBC__
#include <sys/syscall.h>

static int epoll_pwait2(int epfd, struct epoll_event *events, int maxevents,
    const struct timespec *timeout, const sigset_t *sigmask) {
  return syscall(SYS_epoll_pwait2, epfd, events, maxevents, timeout, sigmask, sizeof(sigset_t));
}
#endif
` : ''

export { api, includes, name, constants, structs, preamble }
