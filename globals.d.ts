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
  lo: string,
  v8: string
}

interface Core {
  O_RDONLY: number;
  open(path: string, flags: number, mode: number);
  dlsym(handle: number, name: string): number;
  dlopen(path: string, flags: number): number;
  strnlen(str: string, size: number);
  read_file(path: string): Uint8Array;
  write_file(path: string, buffer: Uint8Array): number;
}

declare class CString extends Uint8Array {
  ptr: number;
  size: number;
}

interface Runtime {
  moduleCache: Map<String, object>;
  libCache: Map<String, object>;
  requireCache: Map<String, object>;
  start: number;
  errno: number;
  colors: any;
  core: Core;
  libraries(): Array<string>;
  builtins(): Array<string>;
  assert(expression: any, message?: string | Function): any;
  cstr(str: string): CString;
  load(name: string): any;
  library(name: string): any;
  /**
   * Prints a string to the console
   * @param [str='a string'] The text to print.
   */
  print(str: string): void;
  exit(status: number): void;
  runMicroTasks(): void;
  hrtime(): number;
  nextTick(callback: function): void;
  getAddress(buf: TypedArray): number;
  utf8Length(str: string): number;
  utf8EncodeInto(str: string, buf: TypedArray): number;
  utf8EncodeIntoAtOffset(str: string, buf: TypedArray, off: number): number;
  utf8_decode(address: number, len?: number): string;
  latin1Decode(address: number, len?: number): string;
  utf8Encode(str: sring): TypedArray;
  wrap(handle: TypedArray, fn: Function, plen: number): function;
  addr(handle: TypedArray): number;
  version: RuntimeVersion;
  args: Array<string>;
  workerSource: string;
  builtin(path: string): string;
  os(): string;
  arch(): string;
  getenv(string): string;
  async evaluateModule(identifier: string): Promise<object>;
  loadModule(src: string, specifier: string): any;
  readMemory(dest: TypedArray, start: number, len: number): void;
  wrapMemory(start: number, size: number, free?: number);
  unwrapMemory(buffer: ArrayBuffer);
  ptr(u8: TypedArray): TypedArray;
  register_callback(ptr: number, fn: Function);
  setModuleCallbacks(on_module_load: Function, 
    on_module_instantiate: Function);
}

declare var lo: Runtime & typeof globalThis;

declare var TextEncoder: {
  prototype: TextEncoder;
  new(): TextEncoder;
} & typeof globalThis;
