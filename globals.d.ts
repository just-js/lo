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
  errno: number;
  assert(expression: any, message?: String | Function): void;
  cstr(str: String): Uint8Array;
  load(name: String): any;
  library(name: String): any;
  runMicroTasks(): void;
  hrtime(): number;
  getAddress(buf: TypedArray): number;
  utf8Length(str: String): number;
  utf8EncodeInto(str: String, buf: TypedArray): number;
  version: RuntimeVersion;
  args: Array<String>;
}

declare var spin: Runtime & typeof globalThis;
declare var TextEncoder: {
  prototype: TextEncoder;
  new(): TextEncoder;
} & typeof globalThis;
