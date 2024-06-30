interface eventCallback { ( fd: number, events: number ): void }

declare class Loop<T extends OS> {
  constructor(nevents?: number, flags?: number);
  readonly size: Number;
  callbacks: Array<Function>;
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
  add(fd: number, callback: eventCallback, flags?: number, errHandler?: Function): number;
  modify(fd: number, callback: eventCallback, flags?: number, errHandler?: Function): number;
  remove: T extends 'linux'
    ? (fd: number) => number
    : T extends 'mac'
      ? (fd: number, flags?: number) => number
      : never;
  poll(timeout?: number): number;
  close(): number;
  add_data: T extends 'mac'
    ? (fd: number, callback: Function, flags?: number, data?: Parameters<typeof BigInt>[number], onerror?: Function) => number
    : never;
}

export interface bindings<T extends OS = CurrentRuntimeGenerics['os']> {
  Loop: T extends 'win' ? never : Loop<T>;
}

