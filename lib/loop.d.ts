const EPOLL_CLOEXEC = 524288
const EPOLLIN = 0x1

interface eventCallback { ( fd: number, events: number ): void };

declare class Loop {
  constructor(nevents?: 4096, flags?: EPOLL_CLOEXEC);
  readonly size: Number;
  static readonly Writable: number;
  static readonly EdgeTriggered: number;
  static readonly Readable: number;

  /**
   * Add a system resource file descriptor to the event loop with a related callback
   * @param fd file descriptor for socket/file/timer system resource
   * @param callback callback function that is called when an event occurs on fd
   * @param flags optional flags - Loop.Readable | Loop.Writable | Loop.EdgeTriggered, default = Loop.Readable + Level Triggered
   * @param errHandler optional callback called when we get ERR or HUP on fd
   */
  add(fd: number, callback: eventCallback, flags?: EPOLLIN, errHandler?: function): number;
  remove(fd: number): number;
  poll(timeout?: number): number;
};

export interface bindings {
  Loop: Loop;
};
