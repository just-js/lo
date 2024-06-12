
// ####### lo_base_types start #######
// please add final edits to lo_base_types in lib/types.js
/// <reference no-default-lib="true"/>
/// <reference lib="es2023"/>
// TODO: refine generic NativeLib* types for lib/<module>/api.js (platform)

// generic typedef helper for classes:
// interface IClassX { ... }
// declare var ClassX: Constructor<IClassX>
// TODO: find solution to class declaration issues (TS class declaration !== JS class declaration)
interface Constructor<T> {
  readonly prototype: T;
  new (): T;
}

type OnUnhandledRejection = (error: Error) => void;

type Require = <T extends Record<string | number | symbol, unknown>>(
  file_path: string
) => T | undefined;

interface Console {
  log: (str: unknown) => number;
  error: (str: unknown) => number;
}

type ZeroOrMinusOne = 0 | -1;
type ENGINE = 'v8';
type OS = 'mac' | 'win' | 'linux';
type ARCH = 'x64' | 'arm64';
type TypedArray =
  | Uint8Array
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array
  | BigUint64Array
  | BigInt64Array
  | ArrayBuffer;

type Ptr<T extends TypedArray> = T & {
  ptr: number;
  size: number;
};

type UnknownLib<T extends string | number> = Record<
  T | string | number | symbol,
  unknown
>;
type Library<T extends string | number> =
  (T extends NativeLibsKeys ? NativeLibXExport<T> : UnknownLib<T>)
    & {
      handle?: number;
      fileName?: string;
      internal?: boolean;
    };

interface RuntimeVersion {
  lo: string;
  v8: string;
}

interface RuntimeGenerics<E extends ENGINE, O extends OS, A extends ARCH> {
  engine: E;
  os: O;
  arch: A;
}

// ####### lo_base_types end #######

// ####### declared_global_types start #######
// please add final edits to declared_global_types in lib/types.js
declare var global: GlobalThis;
declare var onUnhandledRejection: OnUnhandledRejection;
declare var require: Require;
declare var TextEncoder: TextEncoderConstructor;
declare var TextDecoder: TextDecoderConstructor;
declare var lo: Runtime;
declare var console: Console;
// ####### declared_global_types end #######

// ####### global_this_type start #######
// please add final edits to global_this_type in lib/types.js
interface GlobalThis extends GlobalThisBase {
  global:GlobalThis;
  onUnhandledRejection:OnUnhandledRejection;
  require:Require;
  TextEncoder:TextEncoderConstructor;
  TextDecoder:TextDecoderConstructor;
  lo:Runtime;
  console:Console;
}

// ####### global_this_type end #######

// ####### global_this_base_omit_type start #######
// please add final edits to global_this_base_omit_type in lib/types.js
// we define those manually:
type GlobalThisBaseOmit =   | 'global'
  | 'onUnhandledRejection'
  | 'require'
  | 'TextEncoder'
  | 'TextDecoder'
  | 'lo'
  | 'console';

// ####### global_this_base_omit_type end #######

// ####### native_lib_core_type start #######
// please add final edits to native_lib_core_type in lib/types.js
// lo.core = lo.load('core') + overrides listed here
type Core<T extends 'core' = 'core'> = Overwrite<NativeLibXExport<T>[T], {
  dlsym(handle: number, name: string): number;
  dlopen(path: string, flags: number): number;
  // strnlen(str: string | number, size: number): number;
  /**
   * Reads a file from the given path into a Uint8Array and returns it.
   * @param [path] The path to the file.
   */
  read_file(path: string): Uint8Array;
  /**
   * Creates/Overwrites a file at the specified path with the given Uint8Array
   * as the contents of the file.
   * @param {string}[path] The path of the file to create.
   * @param {TypedArray}[buffer] The data write to the file.
   * @returns {number} Number of bytes written
   */
  write_file(
    path: string,
    buffer: Uint8Array,
    flags?: number,
    mode?: number
  ): number;
  os: OS;
  arch: ARCH;
  engine: ENGINE;
  little_endian: boolean;
  homedir: string;
  defaultWriteFlags: number;
  defaultWriteMode: number;
  mmap(
    ptr: number,
    length: number,
    prot: number,
    flags: number,
    fd: number,
    offset: number | Uint32Array
  ): number;
  calloc(num: number, size: number): number;
  memcpy(dest: number, src: number, size: number): number;
  aligned_alloc(alignment: number, size: number): number;
  memmove(dest: number, src: number, size: number): number;
  fork(): number;
  sysconf(num: number): number;
  times(buf: TypedArray): number;
  pread(num: number, buf: TypedArray, num2: number, num3: number): number;
  waitpid(num: number, buf: TypedArray, num2: number): number;
  execve(str: string, buf: TypedArray, buf2: TypedArray): number;
  execvp(str: string, buf: TypedArray): number;
  readlink(path: string, buf: TypedArray, num: number): number;
  getcwd(ptr: number, num: number, buf: Uint32Array): void;
  getenv(name: string, buf: Uint32Array): void;
  write_string(num: number, str: string): number;
  readFile(path: string, flags?: number, size?: number): Uint8Array;
  writeFile(
    path: string,
    u8: Uint8Array,
    flags?: number,
    mode?: number
  ): number;

  isFile(path: string): boolean;
  // conditionally defined props
  loader?: (specifier: string, resource: string) => string;
  sync_loader?: (specifier: string, resource: string) => string;
  binding_loader?: <T extends string>(name: T) => Library<T>;
}>;
// ####### native_lib_core_type end #######

// ####### runtime_type start #######
// please add final edits to runtime_type in lib/types.js
// TODO: autogenerate
interface Runtime {
  // validate with list from: lo eval 'console.log(`"${Object.getOwnPropertyNames(lo).join(`":unknown;"`)}":unknown;`)'
  moduleCache: Map<string, ReturnType<Runtime['loadModule']>>;
  libCache: Map<string, object>;
  requireCache: Map<string, object>;
  start: number;
  errno: number;
  colors: Record<Uppercase<string>, string>;
  core: Core;
  libraries(): string[];
  builtins(): string[];
  assert(expression: any, message?: string | Function): any;
  cstr(str: string): Ptr<Uint8Array>;
  load<T extends NativeLibsKeys>(name: T): NativeLibXExport<T>;
  library<T extends string | number>(name: T): Library<T>;
  /**
   * Prints a string to the console
   * @param [str='a string'] The text to print.
   */
  print(str: string): void;
  exit(status: number): void;
  runMicroTasks(): void;
  hrtime(): number;
  nextTick(callback: Function): void;
  getAddress(buf: TypedArray): number;
  utf8Length(str: string): number;
  utf8EncodeInto(str: string, buf: TypedArray): number;
  utf8EncodeIntoAtOffset(str: string, buf: TypedArray, off: number): number;
  utf8_decode(address: number, len?: number): string;
  latin1Decode(address: number, len?: number): string;
  utf8Encode(str: string): Uint8Array;
  utf8Decode: Runtime['utf8_decode'];
  wrap<
    Handle extends Uint32Array,
    WrappedFnArgs extends unknown[],
    WrappedFnRet,
    State,
  >(
    handle: Handle,
    fn: ((...args: [...WrappedFnArgs]) => WrappedFnRet) & { state?: State },
    plen: number
  ): ((...args: WrappedFnArgs) => number) & { state?: State };
  addr(handle: TypedArray): number;
  version: RuntimeVersion;
  args: string[];
  argv: number;
  argc: number;
  workerSource: string;
  builtin(path: string): string;
  os(): OS;
  arch(): ARCH;
  getenv(str: string): string;
  evaluateModule<T extends object>(identifier: number): Promise<T>;
  loadModule(
    source: string,
    specifier: string
  ): {
    requests: string;
    isSourceTextModule: boolean;
    status: number;
    specifier: string;
    src: string;
    identity: number;
    scriptId: number;
    // js land extensions on returned value
    resource?: string;
    evaluated?: boolean;
    namespace?: object; // module namespace object
  };
  readMemory(dest: TypedArray, start: number, len: number): void;
  wrapMemory(start: number, size: number, free?: number): ArrayBuffer;
  unwrapMemory(buffer: ArrayBuffer): void;
  ptr<T extends TypedArray>(u8: T): Ptr<T>;
  register_callback(ptr: number, fn: Function): void;
  registerCallback: Runtime['register_callback'];
  setModuleCallbacks(
    on_module_load: Function,
    on_module_instantiate: Function
  ): void;

  utf8EncodeIntoPtr(str: string, ptr: number): number;
  runScript(source: string, path: string /* resource name */): void;
  pumpMessageLoop(): void;
  readMemoryAtOffset(
    u8: TypedArray,
    start: number,
    size: number,
    offset: number
  ): void;
  setFlags(str: string): void;
  getMeta: unknown;

  setenv: Core['setenv'];
  getcwd(): string;
  run_script: Runtime['runScript'];
  bindings: Runtime['libraries'];
  evaluate_module: Runtime['evaluateModule'];
  get_address: Runtime['getAddress'];
  get_meta: Runtime['getMeta'];
  latin1_decode: Runtime['latin1Decode'];
  lib_cache: Runtime['libCache'];
  load_module: Runtime['loadModule'];
  module_cache: Runtime['moduleCache'];
  next_tick: Runtime['nextTick'];
  pump_message_loop: Runtime['pumpMessageLoop'];
  read_memory: Runtime['readMemory'];
  read_memory_at_offset: Runtime['readMemoryAtOffset'];
  require_cache: Runtime['requireCache'];
  run_microtasks: Runtime['runMicroTasks'];
  set_flags: Runtime['setFlags'];
  set_module_callbacks: Runtime['setModuleCallbacks'];
  unwrap_memory: Runtime['unwrapMemory'];
  utf8_encode: Runtime['utf8Encode'];
  utf8_encode_into: Runtime['utf8EncodeInto'];
  utf8_encode_into_ptr: Runtime['utf8EncodeIntoPtr'];
  utf8_encode_into_at_offset: Runtime['utf8EncodeIntoAtOffset'];
  utf8_length: Runtime['utf8Length'];
  wrap_memory: Runtime['wrapMemory'];
}
// ####### runtime_type end #######

// ####### text_encoder_types start #######
// please add final edits to text_encoder_types in lib/types.js
type TextEncoderConstructor = Constructor<ITextEncoder>;
interface ITextEncoder {
  /**
   * The encoding supported by the `TextEncoder` instance. Always set to `'utf-8'`.
   */
  readonly encoding: string;
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
  encodeInto(src?: string, dest?: Uint8Array): number;
}

// ####### text_encoder_types end #######

// ####### text_decoder_types start #######
// please add final edits to text_decoder_types in lib/types.js
type TextDecoderConstructor = Constructor<ITextDecoder>;
interface ITextDecoder {
  /**
   * The encoding supported by the `TextEncoder` instance. Always set to `'utf-8'`.
   */
  readonly encoding: string;
  /**
   * UTF-8 decodes the `Uint8Array` and returns an `input` string.
   */
  decode(ptr_source?: Ptr<Uint8Array> | Uint8Array): string;
}
// ####### text_decoder_types end #######

// ####### native_lib_exports_types start #######
// please add final edits to native_lib_exports_types in lib/types.js
// ############ NativeLib Exports stuff ##############
// helpers
type Overwrite<T, U> = Omit<T, keyof U> & U;
type Conditional<
  Type,
  Key extends keyof Type | string | number | symbol,
  FallbackType = never
> = Key extends keyof Type
  ? Type[Key]
  : FallbackType;
type ReadonlyArrayUnknown = ReadonlyArray<unknown>;

// native libs
type NativeLibs = Awaited<typeof import("lib/apis.all.d.ts")>;
// native lib helpers
type NativeLibsKeys = keyof NativeLibs;
type NativeLibX<T extends NativeLibsKeys> = NativeLibs[T];
// get base definition or OS specific schema
type NativeLibXN<T extends NativeLibsKeys, K extends string, O extends OS | -1 = -1>
  = O extends -1 ? Conditional<NativeLibX<T>, K> : Conditional<Conditional<NativeLibX<T>, O>, K>;
// merge base definition schema with one in OS specific schema
type NativeLibXNCombined<
  T extends NativeLibsKeys, S extends string,
  // properly type things based on autogenerated CurrentRuntimeGenerics
  O extends OS = CurrentRuntimeGenerics['os'],
>
  = NativeLibXN<T, S> extends never
    ? NativeLibXN<T, S, O>
    : NativeLibXN<T, S, O> extends never
      ? NativeLibXN<T, S>
      : Overwrite<NativeLibXN<T, S>, NativeLibXN<T, S, O>>;

// consted schemas we care about
type NativeLibXBaseApi<T extends NativeLibsKeys> = NativeLibXNCombined<T, 'api'>;
type NativeLibXBaseName<T extends NativeLibsKeys> = NativeLibXNCombined<T, 'name'>;
type NativeLibXBaseConsts<T extends NativeLibsKeys> = NativeLibXNCombined<T, 'constants'>;
type NativeLibXBaseStructs<T extends NativeLibsKeys> = NativeLibXNCombined<T, 'structs'>;

// all consts are numbers for now
type NativeLibXConsts<T extends NativeLibsKeys, C = NativeLibXBaseConsts<T>> = {
  [k in keyof C]: number;
};

// map to transform fn parameter string into respective type (default is number - not there)
type ParamsTypeMap = {
  buffer: TypedArray;
  string: string;
  u32array: Uint32Array;
  bool: boolean | 1 | 0;
  void: void;
}

// make typed params optional (creates union of fixed size parameter arrays)
type ParamsTypedOptional<T extends ReadonlyArrayUnknown, O extends ReadonlyArrayUnknown> =
  T extends [...infer P extends ReadonlyArray<T[number]>, infer L extends T[number]]
    ? undefined extends L
      ? P['length'] extends keyof O
        ? O[P['length']] extends true | 1 ? P | ParamsTypedOptional<P, O> : T
        : T
      : T
    : T;
// type parameters array(s union)
type ParamsTyped<
  T, P = Conditional<T, 'parameters', -1>, O = Conditional<T, 'optional', -1>,
  PP extends ReadonlyArrayUnknown = P extends ReadonlyArrayUnknown ? P : [],
  OO extends ReadonlyArrayUnknown = O extends ReadonlyArrayUnknown ? O : [],
  PPP extends ReadonlyArrayUnknown = {
    [k in keyof PP]: (
      // ParamsTypedValue
      PP[k] extends keyof ParamsTypeMap
        ? ParamsTypeMap[PP[k]]
        : k extends number
          ? PP[k]
          : number
    ) | (
      // ParamTypedValueOptional
      k extends keyof OO
        ? OO[k] extends true | 1
          ? undefined
          : never
        : never
    )
  }
> = OO[number] extends never ? PPP : PPP | ParamsTypedOptional<PPP, OO>;

// function from definition
type NativeLibApiFn<T, PT extends ParamsTyped<T> = ParamsTyped<T>> =
  (...p: PT) => Conditional<T, 'result', -1> extends 'void' | never ? void : number;
// record of functions from definitions
type NativeLibXApi<
  T extends NativeLibsKeys,
  B extends NativeLibXBaseApi<T> = NativeLibXBaseApi<T>,
>
  = {
    [k in keyof B]: true extends Conditional<B[k], 'declare_only', -1>
      ? never
      : NativeLibApiFn<B[k]>;
  };

// [<name1>, <name2>] => <name1> | <name2>
type NativeLibXStructNames<T extends NativeLibsKeys> = Conditional<NativeLibXBaseStructs<T>, number>;
// struct names => { [struct_<name>_size]: number }
type NativeLibXStructSizes<
  T extends NativeLibsKeys,
  N extends NativeLibXStructNames<T> = NativeLibXStructNames<T>,
  S extends `struct_${string}_size` = N extends string ? `struct_${N}_size` : never
> = {
    [k in S]: number;
  };

// exports loaded by lo.load - { <T>: { ... } }
type NativeLibXExport<
  T extends NativeLibsKeys,
> = Record<
    T,
        (NativeLibXStructSizes<T> extends never ? {} : NativeLibXStructSizes<T>)
      & (NativeLibXConsts<T> extends never ? {} : NativeLibXConsts<T>)
      & (NativeLibXApi<T> extends never ? {} : NativeLibXApi<T>)
      // & (NativeLibXBaseName<T> extends never ? {} : { name: NativeLibXBaseName<T> })
  >;

// ####### native_lib_exports_types end #######


// ####### !!!DO NOT EDIT CODE BELOW THIS LINE! AUTOGENERATED!!! #######
// TODO: add lo.core.engine prop to determine engine
interface CurrentRuntimeGenerics extends RuntimeGenerics<'v8', 'linux', 'x64'> {}
// global base type
// keep only things that we have, no need to confuse people
interface GlobalThisBase
  extends Omit<Pick<
    typeof globalThis,
    // list from: lo eval 'console.log(`"${Object.getOwnPropertyNames(globalThis).join(`"    \n| "`)}"`)'
    | "Object"
    | "Function"
    | "Array"
    | "Number"
    | "parseFloat"
    | "parseInt"
    | "Infinity"
    | "NaN"
    | "undefined"
    | "Boolean"
    | "String"
    | "Symbol"
    | "Date"
    | "Promise"
    | "RegExp"
    | "Error"
    | "AggregateError"
    | "EvalError"
    | "RangeError"
    | "ReferenceError"
    | "SyntaxError"
    | "TypeError"
    | "URIError"
    | "globalThis"
    | "JSON"
    | "Math"
    | "Intl"
    | "ArrayBuffer"
    | "Atomics"
    | "Uint8Array"
    | "Int8Array"
    | "Uint16Array"
    | "Int16Array"
    | "Uint32Array"
    | "Int32Array"
    | "Float32Array"
    | "Float64Array"
    | "Uint8ClampedArray"
    | "BigUint64Array"
    | "BigInt64Array"
    | "DataView"
    | "Map"
    | "BigInt"
    | "Set"
    | "WeakMap"
    | "WeakSet"
    | "Proxy"
    | "Reflect"
    | "FinalizationRegistry"
    | "WeakRef"
    | "decodeURI"
    | "decodeURIComponent"
    | "encodeURI"
    | "encodeURIComponent"
    | "escape"
    | "unescape"
    | "eval"
    | "isFinite"
    | "isNaN"
    | "SharedArrayBuffer"
    // missing typedefs (extract from typescript DOM lib, we don't need DOM messing with types):
    // Iterator
    // WebAssembly
  >,
  GlobalThisBaseOmit
  > {}
