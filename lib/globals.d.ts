// ####### native_lib_api_types start #######
// please add final edits to native_lib_api_types in lib/types.js
// ############ NativeLib API stuff ##############
type LIB_API_ARCH = 'x64';
type LIB_API_C_TYPE = 'u64' | 'f64' | 'u32' | 'i64' | 'f32' | 'i32' | 'u8' | 'void' | 'char';
type LIB_API_POINTER = 'pointer'
type LIB_API_BOOL = 'bool';
type LIB_API_STRING = 'string';
type LIB_API_BUFFER = 'buffer';
type LIB_API_TYPED_ARRAY = 'u32array';

type LibApiParameter = LIB_API_POINTER | LIB_API_C_TYPE | LIB_API_STRING
  | LIB_API_BUFFER | LIB_API_TYPED_ARRAY | LIB_API_BOOL;
type LibApiResult = LIB_API_POINTER | LIB_API_C_TYPE | LIB_API_BOOL;
type LibApiPointer = string; // this is sad
type LibApiOverride = { param: number, fastfield: string, slowfield: string } | number;
type LibApiItem = { nofast: boolean; declare_only: boolean; } | {
  parameters: LibApiParameter[];
  optional?: (true | false | 1 | 0 | undefined)[];
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
type LibApiTypedFn = <const T extends LibApi>(api: T) => T;


type ConstantType = Omit<LIB_API_C_TYPE, 'void' | 'char'> | number;
type LibConstants = Record<string, ConstantType>;
type LibConstsTypedFn = <const T extends LibConstants>(constnats: T) => T;

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
  obj?: string[];
  preamble?: string;
}
type LibPlatformTypedFn = <const T extends Partial<LibPlatform>>(platform: T) => T;

// ####### native_lib_api_types end #######
