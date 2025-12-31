#include <lo.h>
#include <windows.h>

namespace lo {
namespace core {

using v8::Local;
using v8::ObjectTemplate;
using v8::Isolate;
using v8::Value;
using v8::FunctionCallbackInfo;
using v8::CTypeInfo;
using v8::CFunctionInfo;
using v8::CFunction;
using v8::String;
using v8::Number;
using v8::BigInt;
using v8::Integer;

unsigned int testFast(void* p);

CTypeInfo cargstest[1] = {
  CTypeInfo(CTypeInfo::Type::kV8Value),
};
CTypeInfo rctest = CTypeInfo(CTypeInfo::Type::kUint32);
CFunctionInfo infotest = CFunctionInfo(rctest, 1, cargstest);
CFunction pFtest = CFunction((const void*)&testFast, &infotest);

unsigned int testFast(void* p) {
  return 1;
}

void testSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  args.GetReturnValue().Set(1);
}

// https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-copyfile
void copyFile(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  String::Utf8Value source(isolate, args[0]);
  String::Utf8Value dest(isolate, args[1]);
  bool ok = CopyFile(*source, *dest, true);
  args.GetReturnValue().Set(ok);
}

// https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror
// https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes
// https://learn.microsoft.com/en-us/windows/win32/debug/retrieving-the-last-error-code
void getLastError(const FunctionCallbackInfo<Value> &args) {
  args.GetReturnValue().Set(Number::New(args.GetIsolate(), GetLastError()));
}

// https://learn.microsoft.com/en-us/windows/win32/api/handleapi/nf-handleapi-closehandle
void closeHandle (const FunctionCallbackInfo<Value> & args) {
  Isolate *isolate = args.GetIsolate();
  uint32_t v0 = Local<Integer>::Cast(args[0])->Value();
  HANDLE file = reinterpret_cast<HANDLE>(v0);
  BOOL ok = CloseHandle(file);
  if (ok) {
    args.GetReturnValue().Set(true);
    return;
  }
  args.GetReturnValue().Set(false);
}

// https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfilesize
void getFileSize (const FunctionCallbackInfo<Value> & args) {
  Isolate *isolate = args.GetIsolate();
  uint32_t v0 = Local<Integer>::Cast(args[0])->Value();
  HANDLE file = reinterpret_cast<HANDLE>(v0);
  DWORD fileSize = GetFileSize(file, NULL);
  if (fileSize == INVALID_FILE_SIZE) {
    args.GetReturnValue().Set(-1);
    return;
  }
  args.GetReturnValue().Set(Number::New(isolate, fileSize));
}

// https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfiletype
void getFileType (const FunctionCallbackInfo<Value> & args) {
  Isolate *isolate = args.GetIsolate();
  uint32_t v0 = Local<Integer>::Cast(args[0])->Value();
  HANDLE file = reinterpret_cast<HANDLE>(v0);
  DWORD fileType = GetFileType(file);
  args.GetReturnValue().Set(Number::New(isolate, fileType));
}

// https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile
void readFile (const FunctionCallbackInfo<Value> & args) {
  Isolate *isolate = args.GetIsolate();
  uint32_t v0 = Local<Integer>::Cast(args[0])->Value();
  char* buffer = reinterpret_cast<char*>((uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t len = Local<Integer>::Cast(args[2])->Value();
  // HANDLE's *should* be 32 bit safe - reference?
  HANDLE file = reinterpret_cast<HANDLE>(v0);
  DWORD bytesRead;
  BOOL ok = ReadFile(file, buffer, len, &bytesRead, NULL);
  if (ok) {
    args.GetReturnValue().Set(Number::New(isolate, bytesRead));
    return;
  }
  args.GetReturnValue().Set(-1);
}

// https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-writefile
void writeFile (const FunctionCallbackInfo<Value> & args) {
  Isolate *isolate = args.GetIsolate();
  uint32_t v0 = Local<Integer>::Cast(args[0])->Value();
  char* buffer = reinterpret_cast<char*>((uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t len = Local<Integer>::Cast(args[2])->Value();
  // HANDLE's *should* be 32 bit safe - reference?
  HANDLE file = reinterpret_cast<HANDLE>(v0);
  DWORD bytesWritten;
  BOOL ok = WriteFile(file, buffer, len, &bytesWritten, NULL);
  if (ok) {
    args.GetReturnValue().Set(Number::New(isolate, bytesWritten));
    return;
  }
  args.GetReturnValue().Set(-1);
}

// https://learn.microsoft.com/en-us/windows/win32/fileio/creating-and-opening-files
// https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilea
void createFile(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  String::Utf8Value path(isolate, args[0]);
  uint32_t access = Local<Integer>::Cast(args[1])->Value();
  uint32_t mode = Local<Integer>::Cast(args[2])->Value();
  HANDLE file = CreateFile(*path, access, 0, NULL, mode, FILE_ATTRIBUTE_NORMAL, NULL);
  if (file == INVALID_HANDLE_VALUE) {
    args.GetReturnValue().Set(-1);
    return;
  }
  args.GetReturnValue().Set(Number::New(isolate, reinterpret_cast<uint64_t>(file)));
}

// https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-getenvironmentvariable
void getEnv(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  String::Utf8Value name(isolate, args[0]);
  char* buffer = reinterpret_cast<char*>((uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t len = Local<Integer>::Cast(args[2])->Value();
  args.GetReturnValue().Set(Number::New(isolate, GetEnvironmentVariable(*name, buffer, len)));
}

// https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setenvironmentvariable
void setEnv(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  String::Utf8Value name(isolate, args[0]);
  String::Utf8Value value(isolate, args[1]);
  BOOL ok = SetEnvironmentVariable(*name, *value);
  if (ok) {
    args.GetReturnValue().Set(true);
    return;
  }
  args.GetReturnValue().Set(false);
}

// https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-loadlibrarya
void loadLibrary(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  String::Utf8Value path(isolate, args[0]);
  args.GetReturnValue().Set(Number::New(isolate, reinterpret_cast<uint64_t>(LoadLibraryA(*path))));
}

// https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-freelibrary
void freeLibrary(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  uint64_t v0 = (uint64_t)Local<Number>::Cast(args[0])->Value();
  HMODULE handle = reinterpret_cast<HMODULE>(v0);
  BOOL ok = FreeLibrary(handle);
  if (ok) {
    args.GetReturnValue().Set(true);
    return;
  }
  args.GetReturnValue().Set(false);
}

// https://learn.microsoft.com/en-us/windows/win32/api/libloaderapi/nf-libloaderapi-getprocaddress
void getProcAddress(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  uint64_t v0 = (uint64_t)Local<Number>::Cast(args[0])->Value();
  String::Utf8Value name(isolate, args[1]);
  HMODULE handle = reinterpret_cast<HMODULE>(v0);
  FARPROC fp = GetProcAddress(handle, *name);
  args.GetReturnValue().Set(Number::New(isolate, reinterpret_cast<uint64_t>(fp)));
}

void Init(Isolate *isolate, Local<ObjectTemplate> target) {
  Local<ObjectTemplate> module = ObjectTemplate::New(isolate);

  SET_METHOD(isolate, module, "testSlow", testSlow);
  SET_FAST_METHOD(isolate, module, "test", &pFtest, testSlow);

  SET_METHOD(isolate, module, "getLastError", getLastError);

  SET_METHOD(isolate, module, "createFile", createFile);
  SET_METHOD(isolate, module, "getFileSize", getFileSize);
  SET_METHOD(isolate, module, "getFileType", getFileType);
  SET_METHOD(isolate, module, "copyFile", copyFile);
  SET_METHOD(isolate, module, "readFile", readFile);
  SET_METHOD(isolate, module, "writeFile", writeFile);
  SET_METHOD(isolate, module, "closeHandle", closeHandle);

  SET_METHOD(isolate, module, "loadLibrary", loadLibrary);
  SET_METHOD(isolate, module, "getProcAddress", getProcAddress);
  SET_METHOD(isolate, module, "freeLibrary", freeLibrary);

  SET_METHOD(isolate, module, "getenv", getEnv);
  SET_METHOD(isolate, module, "setenv", setEnv);

  SET_VALUE(isolate, module, "GENERIC_READ", Integer::New(isolate, (int32_t)GENERIC_READ));
  SET_VALUE(isolate, module, "GENERIC_WRITE", Integer::New(isolate, (int32_t)GENERIC_WRITE));

  SET_VALUE(isolate, module, "FILE_SHARE_READ", Integer::New(isolate, (int32_t)FILE_SHARE_READ));
  SET_VALUE(isolate, module, "FILE_SHARE_WRITE", Integer::New(isolate, (int32_t)FILE_SHARE_WRITE));

  SET_VALUE(isolate, module, "CREATE_ALWAYS", Integer::New(isolate, (int32_t)CREATE_ALWAYS));
  SET_VALUE(isolate, module, "CREATE_NEW", Integer::New(isolate, (int32_t)CREATE_NEW));
  SET_VALUE(isolate, module, "OPEN_ALWAYS", Integer::New(isolate, (int32_t)OPEN_ALWAYS));
  SET_VALUE(isolate, module, "OPEN_EXISTING", Integer::New(isolate, (int32_t)OPEN_EXISTING));
  SET_VALUE(isolate, module, "TRUNCATE_EXISTING", Integer::New(isolate, (int32_t)TRUNCATE_EXISTING));

  SET_VALUE(isolate, module, "FILE_ATTRIBUTE_NORMAL", Integer::New(isolate, (int32_t)FILE_ATTRIBUTE_NORMAL));
  SET_VALUE(isolate, module, "FILE_ATTRIBUTE_READONLY", Integer::New(isolate, (int32_t)FILE_ATTRIBUTE_READONLY));
  SET_VALUE(isolate, module, "FILE_ATTRIBUTE_TEMPORARY", Integer::New(isolate, (int32_t)FILE_ATTRIBUTE_TEMPORARY));

  SET_VALUE(isolate, module, "FILE_TYPE_CHAR", Integer::New(isolate, (int32_t)FILE_TYPE_CHAR));
  SET_VALUE(isolate, module, "FILE_TYPE_DISK", Integer::New(isolate, (int32_t)FILE_TYPE_DISK));
  SET_VALUE(isolate, module, "FILE_TYPE_PIPE", Integer::New(isolate, (int32_t)FILE_TYPE_PIPE));
  SET_VALUE(isolate, module, "FILE_TYPE_REMOTE", Integer::New(isolate, (int32_t)FILE_TYPE_REMOTE));
  SET_VALUE(isolate, module, "FILE_TYPE_UNKNOWN", Integer::New(isolate, (int32_t)FILE_TYPE_UNKNOWN));

  SET_VALUE(isolate, module, "INVALID_HANDLE_VALUE", Integer::New(isolate, -1));

  SET_MODULE(isolate, target, "core", module);
}

} // namespace core
} // namespace lo

extern "C"  {
  void* _register_core() {
    return (void*)lo::core::Init;
  }
}
