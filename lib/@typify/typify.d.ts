
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
  man?: string[] | string;
  nofast?: boolean;
  nonblocking?: boolean;
};
type LibApi = Record<string, LibApiItem>;
export const lib_api_typed: <const T extends LibApi>(api: T) => T;


type ConstantType = Omit<CType, 'void' | 'char'> | number;
type LibConstants = Record<string, ConstantType>;
export const lib_constants_typed: <const T extends LibConstants>(constnats: T) => T;

type Platform = 'mac' | 'linux';
interface LibPlatform {
  name: string;
  api: LibApi;
  constants?: LibConstants;
  structs?: string[];
  includes?: string[];
  libs?: string[];
  externs?: string[];
  include_paths?: string[];
  lib_paths?: string[];
  obj?: (`${string}.${'a' | 'o'}`)[];
  preamble?: string;
}
export const lib_platform_typed: <const T extends Partial<LibPlatform>>(platform: T) => T;
