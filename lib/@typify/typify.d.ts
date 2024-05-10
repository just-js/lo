
type ARCH = 'x64';
type CType = 'u64' | 'f64' | 'u32' | 'i64' | 'f32' | 'i32' | 'u8' | 'void' | 'char';
type Pointer = 'pointer'
type Bool = 'bool';
type String = 'string';
type Buffer = 'buffer';
type TypedArray = 'u32array';

// lib_api_typed
type LibApiParameter = Pointer | CType | String | Buffer | TypedArray | Bool;
type LibApiResult = Pointer | CType | Bool;
type LibApiPointer = string; // this is sad
type LibApiOverride = { param: number, fastfield: `${string}->${string}`, slowfield: `${string}.${string}()` } | number;
type LibApiItem = { nofast: boolean; declare_only: boolean; } | {
  parameters: LibApiParameter[];
  pointers?: (LibApiPointer | void)[];
  result: LibApiResult;
  rpointer?: LibApiPointer | [LibApiPointer];
  name?: string;
  arch?: ARCH[];
  override?: (LibApiOverride | void)[];
  casts?: (string | void)[];
  jsdoc?: string;
  man?: string[];
  nofast?: boolean;
  nonblocking?: boolean;
};
type LibApi = Record<string, LibApiItem>;

// TODO: add lib_exports_typed to get types for lib exports
export const lib_api_typed: <const T extends LibApi>(api: T) => T;
