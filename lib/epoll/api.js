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

// errno.h: real, direct requirement for the EAGAIN constant below -- was
// silently covered by bindings() always including <v8.h> first (which
// transitively drags in enough of the standard library to mask this);
// surfaced building this binding under the abi target, which includes
// no engine header at all. Doesn't change the v8-specific build's own
// behavior, just makes an already-real dependency explicit.
const includes = ['sys/epoll.h', 'unistd.h', 'sys/prctl.h', 'errno.h']
const structs = ['epoll_event']
const name = 'epoll'

const preamble = `
#ifdef __linux__
#ifndef __GLIBC__
#include <sys/syscall.h>

static int epoll_pwait2(int epfd, struct epoll_event *events, int maxevents,
    const struct timespec *timeout, const sigset_t *sigmask) {
  return syscall(SYS_epoll_pwait2, epfd, events, maxevents, timeout, sigmask, sizeof(sigset_t));
}
#endif
#endif
`

export { api, includes, name, constants, structs, preamble }
