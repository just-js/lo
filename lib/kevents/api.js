const api = {
  kqueue: {
    parameters: [],
    result: 'i32'
  },
  kevent: {
    parameters: ['i32', 'pointer', 'i32', 'pointer', 'i32', 'pointer'],
    pointers: [, 'const struct kevent *', , 'struct kevent *', , 'const struct timespec *'],
    result: 'i32'
  },
  kevent64: {
    parameters: ['i32', 'pointer', 'i32', 'pointer', 'i32', 'u32', 'pointer'],
    pointers: [, 'const struct kevent64_s *', , 'struct kevent64_s *', , , 'const struct timespec *'],
    result: 'i32'
  }
}

const name = 'kevents'

const constants = {
  EVFILT_READ: 'i32',
  EVFILT_EXCEPT: 'i32',
  EVFILT_WRITE: 'i32',
  EVFILT_VNODE: 'i32',
  EVFILT_PROC: 'i32',
  EVFILT_SIGNAL: 'i32',
  EVFILT_MACHPORT: 'i32',
  EVFILT_TIMER: 'i32',
  EV_ADD: 'i32',
  EV_ENABLE: 'i32',
  EV_DISABLE: 'i32',
  EV_DELETE: 'i32',
  EV_RECEIPT: 'i32',
  EV_ONESHOT: 'i32',
  EV_CLEAR: 'i32',
  EV_EOF: 'i32',
  EV_OOBAND: 'i32',
  EV_ERROR: 'i32',
  KEVENT_FLAG_IMMEDIATE: 'i32',
  KEVENT_FLAG_ERROR_EVENTS: 'i32',
  // FS Flags
  NOTE_DELETE: 'i32',
  NOTE_WRITE: 'i32',
  NOTE_EXTEND: 'i32',
  NOTE_ATTRIB: 'i32',
  NOTE_LINK: 'i32',
  NOTE_RENAME: 'i32',
  NOTE_REVOKE: 'i32',
  NOTE_FUNLOCK: 'i32',
  NOTE_LEASE_DOWNGRADE: 'i32',
  NOTE_LEASE_RELEASE: 'i32',
  // Proc Flags
  NOTE_EXIT: 'i32',
  NOTE_EXITSTATUS: 'i32',
  NOTE_FORK: 'i32',
  NOTE_EXEC: 'i32',
  NOTE_SIGNAL: 'i32',
//  NOTE_REAP: 'i32',
  // Timer Flags
  NOTE_SECONDS: 'i32',
  NOTE_USECONDS: 'i32',
  NOTE_NSECONDS: 'i32',
  NOTE_MACHTIME: 'i32',
  NOTE_CRITICAL: 'i32',
  NOTE_BACKGROUND: 'i32',
  NOTE_LEEWAY: 'i32',
  // Oneshot
  NOTE_ABSOLUTE: 'i32',
  NOTE_OOB: 'i32',
  NOTE_LOWAT: 'i32',
}

const includes = [
  'sys/event.h', 'sys/types.h', 'sys/time.h'
]

const structs = [
  'struct kevent', 'kevent64_s', 'time_t', 'timespec'
]

export { name, api, constants, includes, structs }
