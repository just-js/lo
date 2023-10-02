declare class TextEncoder {
  /**
   * The encoding supported by the `TextEncoder` instance. Always set to `'utf-8'`.
   */
  readonly encoding: "utf-8";
  constructor(encoding?: "utf-8");
  /**
   * UTF-8 encodes the `input` string and returns a `Uint8Array` containing the
   * encoded bytes.
   * @param [input='an empty string'] The text to encode.
   */
  encode(input?: string): Uint8Array;
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
  encodeInto(src?: string, dest?: BufferSource): EncodeIntoResult;
}

interface RuntimeVersion {
  spin: number,
  v8: number
}

interface Runtime {
  start: number;
  errno: number;
  assert(expression: any, message?: string | Function): any;
  cstr(str: string): Uint8Array;
  load(name: string): any;
  library(name: string): any;
  runMicroTasks(): void;
  hrtime(): number;
  nextTick(callback: function): void;
  getAddress(buf: TypedArray): number;
  utf8Length(str: string): number;
  utf8EncodeInto(str: string, buf: TypedArray): number;
  utf8Decode(buf: TypedArray, len: number): string;
  wrap(handle: TypedArray, fn: Function, plen: number): function;
  addr(handle: TypedArray): number;
  dlsym(handle: number, name: string): number;
  dlopen(path: string, flags: number): number;
  version: RuntimeVersion;
  args: Array<string>;
  workerSource: string;
  builtin(path: string): string;
  async evaluateModule(identifier: string): Promise<object>;
  loadModule(src: string, specifier: string): Object;
  readMemory(dest: TypedArray, start: number, len: number): void;
  wrapMemory(start: number, end: number, free?: number);
  unwrapMemory(buffer: ArrayBuffer);
  ptr(u8: TypedArray): TypedArray;
  registerCallback(ptr: number, fn: Function);
}

declare var spin: Runtime & typeof globalThis;

declare var TextEncoder: {
  prototype: TextEncoder;
  new(): TextEncoder;
} & typeof globalThis;
