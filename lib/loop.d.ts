const EPOLL_CLOEXEC = 524288
const EPOLLIN = 0x1

interface eventCallback { ( fd: number, events: number ): void };

declare class Loop {
  constructor(nevents?: 4096, flags?: EPOLL_CLOEXEC);
  readonly size: Number;
  callbacks: Array<function>;
  static readonly Writable: number;
  static readonly EdgeTriggered: number;
  static readonly Readable: number;
  static readonly Blocked: number;

  /**
   * UTF-8 encodes the `src` string to the `dest` Uint8Array and returns an object
   * containing the read Unicode code units and written UTF-8 bytes.
   *
   * ```js
   * const encoder = new TextEncoder();
   * const src = 'this is some data';
   * const dest = new Uint8Array(10);
   * const { read, written } = encoder.encodeInto(src, dest);
   * ```
   * @param src The text to encode.
   * @param dest The array to hold the encode result.
   */


  /**
   * Add a system resource file descriptor to the event loop with a related callback
   *
   * ```js
   * const loop = new Loop()
   * assert(loop.add(fd, () => {}, Loop.Readable, err => {}) === 0)
   * ```
   * @param fd file descriptor for socket/file/timer system resource
   * @param callback callback function that is called when an event occurs on fd
   * @param flags optional flags - Loop.Readable | Loop.Writable | Loop.EdgeTriggered, default = Loop.Readable + Level Triggered
   * @param errHandler optional callback called when we get ERR or HUP on fd
   */
  add(fd: number, callback: eventCallback, flags?: EPOLLIN, errHandler?: function): number;
  modify(fd: number, callback: eventCallback, flags?: EPOLLIN, errHandler?: function): number;
  remove(fd: number): number;
  poll(timeout?: number): number;
};

export interface bindings {
  Loop: Loop;
};

