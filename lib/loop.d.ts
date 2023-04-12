const EPOLL_CLOEXEC = 524288
const EPOLLIN = 0x1

interface eventCallback { ( fd: number, events: number ): void };

declare class Loop {
  constructor(nevents?: 4096, flags?: EPOLL_CLOEXEC);
  readonly size: Number;

  /**
   * The encoding supported by the `TextEncoder` instance. Always set to `'utf-8'`.
   * @param fd The text to encode.
   * @param callback The array to hold the encode result.
   */
  add(fd: number, callback: eventCallback, flags?: EPOLLIN, errHandler?: function): number;
};

export interface bindings {
  Loop: Loop;
};
