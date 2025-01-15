const api = {
// dynamic loader
// this is just an example of a jsdoc. should we embed jsdoc here or generate it?
// we should generate wrappers in JS with the JSdoc in them
  dlopen: {
    parameters: ['string', 'i32'],
    pointers: ['const char*'],
    jsdoc: `/**
* The  function  dlopen()  loads  the  dynamic shared object (shared library)
* file named by the null-terminated string filename and returns an opaque
* "handle" for the loaded object.  This handle is employed with other
* functions in the dlopen API, such as dlsym(3), dladdr(3), dlinfo(3),
* and dlclose()
*
* \`\`\`js
* const handle = assert(core.dlopen('libcurl.so', core.RTLD_NOW));
* \`\`\`
* @param file_path {string} the path to the shared library file to open.
* @param flags {number} (i32) resolve symbols now (RTLD_NOW) or lazily (RTLD_LAZY)
*/`,
    result: 'pointer',
    man: [
      'https://man7.org/linux/man-pages/man3/dlopen.3.html',
      'https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man3/dlopen.3.html'
    ]
  },
  dlsym: {
    parameters: ['pointer', 'string'],
    pointers: ['void*', 'const char*'],
    result: 'pointer'
  },
  dlclose: {
    parameters: ['pointer'],
    pointers: ['void*'],
    result: 'i32'
  },
// file descriptor operations
  read: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  read2: {
    parameters: ['i32', 'pointer', 'i32'],
    result: 'i32',
    name: 'read'
  },
  write: {
    parameters: ['i32', 'buffer', 'i32'],
    result: 'i32'
  },
  write_string: {
    parameters: ['i32', 'string', 'i32'],
    pointers: [, 'const char*'],
    override: [, , { param: 1, fastfield: '->length', slowfield: '.length()' }],
    result: 'i32',
    name: 'write'
  },
  putchar: {
    parameters: ['i32'],
    result: 'i32'
  },
  close: {
    parameters: ['i32'],
    result: 'i32'
  },
  pread: {
    parameters: ['i32', 'buffer', 'i32', 'u32'],
    result: 'i32'
  },
  lseek: {
    parameters: ['i32', 'u32', 'i32'],
    result: 'u32'
  },
  fstat: {
    parameters: ['i32', 'buffer'],
    pointers: [, 'struct stat *'],
    result: 'i32'
  },
  fcntl: {
    parameters: ['i32', 'i32', 'i32'],
    result: 'i32'
  },
  ftruncate: {
    parameters: ['i32', 'u32'],
    result: 'i32'
  },
// file system operations
  mknod: {
    parameters: ['string', 'i32', 'i32'],
    result: 'i32'
  },
  stat: {
    parameters: ['string', 'buffer'],
    pointers: [, 'struct stat *'],
    result: 'i32'
  },
  lstat: {
    parameters: ['string', 'buffer'],
    pointers: [, 'struct stat *'],
    result: 'i32'
  },
  rename: {
    parameters: ['string', 'string'],
    result: 'i32'
  },
  access: {
    parameters: ['string', 'i32'],
    result: 'i32'
  },
  open: {
    parameters: ['string', 'i32', 'i32'],
    pointers: ['const char*'],
    result: 'i32'
  },
  unlink: {
    parameters: ['string'],
    result: 'i32'
  },
  openat: {
    parameters: ['i32', 'string', 'i32'],
    result: 'i32',
  },
  readdir: {
    parameters: ['pointer'],
    result: 'pointer',
    pointers: ['DIR*'],
    rpointer: 'dirent*'
  },
  readlink: {
    parameters: ['string', 'buffer', 'u32'],
    pointers: ['const char*', 'char*'],
    result: 'u32'
  },
  opendir: {
    parameters: ['string'],
    result: 'pointer',
    pointers: ['const char*'],
    rpointer: 'DIR*'
  },
  fstatat: {
    parameters: ['i32', 'string', 'buffer', 'i32'],
    pointers: [, , 'struct stat *'],
    result: 'i32'
  },
  mkdir: {
    parameters: ['string', 'u32'],
    result: 'i32',
  },
  rmdir: {
    parameters: ['string'],
    result: 'i32',
  },
  closedir: {
    parameters: ['pointer'],
    pointers: ['DIR*'],
    result: 'i32'
  },
  chdir: {
    parameters: ['string'],
    result: 'i32',
  },
  fchdir: {
    parameters: ['i32'],
    result: 'i32',
  },
// memory operations
  mprotect: {
    parameters: ['pointer', 'u32', 'i32'],
    result: 'i32'
  },
  memcpy: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  memset: {
    parameters: ['pointer', 'i32', 'u32'],
    result: 'pointer'
  },
  memmove: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer'
  },
  shm_open : {
    parameters: ['string', 'i32', 'i32'],
    result: 'i32'
  },
  shm_unlink : {
    parameters: ['string'],
    result: 'i32'
  },
  mmap: {
    parameters: ['pointer', 'u32', 'i32', 'i32', 'i32', 'u32'],
    result: 'pointer'
  },
  munmap: {
    parameters: ['pointer', 'u32'],
    result: 'i32'
  },
  msync: {
    parameters: ['pointer', 'u32', 'i32'],
    result: 'i32'
  },
  malloc: {
    parameters: ['u32'],
    result: 'pointer'
  },
  calloc: {
    parameters: ['u32', 'u32'],
    result: 'pointer'
  },
  realloc: {
    parameters: ['pointer', 'u32'],
    result: 'pointer'
  },
  aligned_alloc: {
    parameters: ['u32', 'u32'],
    result: 'pointer'
  },
  free: {
    parameters: ['pointer'],
    result: 'void'
  },
// fastcalls
  bind_fastcall: {
    declare_only: true,
    nofast: true
  },
  bind_slowcall: {
    declare_only: true,
    nofast: true
  },
  fastcall: {
    parameters: ['pointer'],
    pointers: ['struct fastcall*'],
    result: 'void',
    name: 'lo_fastcall'
  },
// system
  getenv: {
    parameters: ['string'],
    pointers: ['const char*'],
    rpointer: 'char*',
    result: 'pointer'
  },
  setenv: {
    parameters: ['string', 'string', 'i32'],
    pointers: ['const char*', 'const char*'],
    result: 'i32'
  },
  unsetenv: {
    parameters: ['string'],
    pointers: ['const char*'],
    result: 'i32'
  },
  sleep: {
    parameters: ['i32'],
    result: 'void'
  },
  usleep: {
    parameters: ['u32'],
    result: 'i32'
  },
  dup: {
    parameters: ['i32'],
    result: 'i32'
  },
  dup2: {
    parameters: ['i32', 'i32'],
    result: 'i32'
  },
  getcwd: {
    parameters: ['pointer', 'i32'],
    pointers: ['char*'],
    result: 'pointer'
  },
  getpid: {
    parameters: [],
    result: 'i32'
  },
  fork: {
    parameters: [],
    result: 'i32'
  },
  kill: {
    parameters: ['i32', 'i32'],
    result: 'i32'
  },
  waitpid: {
    parameters: ['i32', 'buffer', 'i32'],
    pointers: [, 'int*'],
    result: 'i32'
  },
  execvp: {
    parameters: ['string', 'buffer'],
    pointers: ['const char*', 'char* const*'],
    result: 'i32',
  },
  execve: {
    parameters: ['string', 'buffer', 'buffer'],
    pointers: ['const char*', 'char* const*', 'char* const*'],
    result: 'i32',
  },
  isatty: {
    parameters: ['i32'],
    result: 'i32'
  },
  tcgetattr: {
    parameters: ['i32', 'buffer'],
    pointers: [, 'struct termios *'],
    result: 'i32'
  },
  tcsetattr: {
    parameters: ['i32', 'i32', 'buffer'],
    pointers: [, , 'struct termios *'],
    result: 'i32'
  },
  exit: {
    parameters: ['i32'],
    result: 'void'
  },
  sysconf: {
    parameters: ['i32'],
    result: 'u32'
  },
// rusage
  getrusage: {
    parameters: ['i32', 'buffer'],
    pointers: [, 'struct rusage*'],
    result: 'i32'
  },
  times: {
    parameters: ['buffer'],
    pointers: ['struct tms*'],
    result: 'u32'
  },
// isolates
  isolate_create: {
    parameters: [
      'i32', 'u32array', 'string', 'u32', 'string', 'u32', 'buffer',
      'i32', 'i32', 'u64', 'string', 'string', 'i32', 'i32', 'pointer'
    ],
    pointers: [
      , 'char**', 'const char*', , 'const char*', , 'char*', , ,
      'const char*', 'const char*'
    ],
    result: 'i32',
    name: 'lo_create_isolate',
    jsdoc: ``,
    nofast: true
  },
  isolate_context_create: {
    parameters: [
      'i32', 'pointer', 'string', 'u32', 'string', 'u32', 'pointer',
      'i32', 'i32', 'u64', 'string', 'string', 'i32', 'i32', 'pointer', 'buffer'
    ],
    pointers: [
      , 'char**', 'const char*', , 'const char*', , 'char*', , ,
      'const char*', 'const char*', , , , , 'struct isolate_context*'
    ],
    result: 'void',
    name: 'lo_create_isolate_context',
    nofast: true
  },
  isolate_context_destroy: {
    parameters: ['buffer'],
    pointers: ['struct isolate_context*'],
    result: 'void',
    name: 'lo_destroy_isolate_context'
  },
  isolate_context_size: {
    parameters: [],
    result: 'i32',
    name: 'lo_context_size'
  },
  isolate_start: {
    parameters: ['buffer'],
    result: 'void',
    name: 'lo_start_isolate',
    nofast: true
  },
  callback: {
    parameters: ['pointer'],
    pointers: ['exec_info*'],
    result: 'void',
    name: 'lo_callback',
    nofast: true
  },
// strings
  memmem: {
    parameters: ['pointer', 'u32', 'pointer', 'u32'],
    result: 'pointer'
  },
  strnlen: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'u32'
  },
  strnlen_str: {
    parameters: ['string', 'u32'],
    override: [, { param: 0, fastfield: '->length', slowfield: '.length()' }],
    pointers: ['const char*'],
    result: 'u32',
    name: 'strnlen'
  },
/*
  mmio_signal: {
    parameters: [],
    result: 'void'
  },
*/
  sync: {
    parameters: [],
    result: 'void'
  },
}

// optional preamble of C/C++ code to embed in the generated source file before
// compilation
const preamble = `
#include <sys/types.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <unistd.h>
#include <string.h>

//#define MAGIC_VALUE_SIGNAL_GUEST_BOOT_COMPLETE 123

// used for firecracker startup time testing
/*
void mmio_signal (void) {
  unsigned long FIRST_ADDR_PAST_32BITS = (1UL << 32);
  unsigned long MEM_32BIT_GAP_SIZE = (768UL << 20);

  int fd = open("/dev/mem", (O_RDWR | O_SYNC | O_CLOEXEC));
  int mapped_size = getpagesize();
  char *map_base = (char *)mmap(NULL,
    mapped_size,
    PROT_WRITE,
    MAP_SHARED,
    fd,
    FIRST_ADDR_PAST_32BITS - MEM_32BIT_GAP_SIZE);
  *map_base = MAGIC_VALUE_SIGNAL_GUEST_BOOT_COMPLETE;
  msync(map_base, mapped_size, MS_SYNC);
  munmap(map_base, mapped_size);
  close(fd);
}
*/

struct fastcall {
  void* wrapper;      // 0-7   :   v8 fastcall wrapper function pointer
  uint8_t result;     // 8     :   the type of the result
  uint8_t nparam;     // 9     :   the number of args (max 255) 
  uint8_t param[30];  // 10-39 :   an array of types of the arguments
  uint64_t args[32];  // 40-295:   an array of pointer slots for arguments
                      // these will be filled in dynamically by 
                      // lo::core::SlowCallback for the slow call
                      // and then the slowcall wrapper will shift them from
                      // this structure into regs + stack and make the call
                      // the first slot is reserved for the result
  void* fn;           // 296-303:  the slowcall wrapper function pointer
};

typedef void (*lo_fast_call)(void*);

inline uint8_t needsunwrap (lo::FastTypes t) {
  if (t == lo::FastTypes::buffer) return 1;
  if (t == lo::FastTypes::u32array) return 1;
  if (t == lo::FastTypes::pointer) return 1;
  if (t == lo::FastTypes::u64) return 1;
  if (t == lo::FastTypes::i64) return 1;
  return 0;
}

v8::CTypeInfo* CTypeFromV8 (uint8_t v8Type) {
  if (v8Type == lo::FastTypes::boolean)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kBool);
  if (v8Type == lo::FastTypes::i8)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  if (v8Type == lo::FastTypes::i16)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  if (v8Type == lo::FastTypes::i32)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt32);
  if (v8Type == lo::FastTypes::u8)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  if (v8Type == lo::FastTypes::u16)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  if (v8Type == lo::FastTypes::u32)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32);
  if (v8Type == lo::FastTypes::f32)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kFloat32);
  if (v8Type == lo::FastTypes::f64)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kFloat64);
  if (v8Type == lo::FastTypes::i64)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt64);
  if (v8Type == lo::FastTypes::u64)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == lo::FastTypes::iSize)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kInt64);
  if (v8Type == lo::FastTypes::uSize)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == lo::FastTypes::pointer)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == lo::FastTypes::function)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint64);
  if (v8Type == lo::FastTypes::string)
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kSeqOneByteString);
  if (v8Type == lo::FastTypes::buffer) {
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint8,
      v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  }
  if (v8Type == lo::FastTypes::u32array) {
    return new v8::CTypeInfo(v8::CTypeInfo::Type::kUint32,
      v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone);
  }
  return new v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
}

void lo_fastcall (struct fastcall* state) {
  ((lo_fast_call)state->fn)(&state->args);
}

void SlowCallback(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  struct fastcall* state = (struct fastcall*)args.Data()
    .As<Object>()->GetAlignedPointerFromInternalField(1);
/*
  int r = 1;
  for (int i = 0; i < state->nparam; i++) {
    if (state->param[i] == FastTypes::string) {
      String::Utf8Value arg0(isolate, args[i]);
      state->args[r++] = (uint64_t)*arg0;
    } else if (state->param[i] == FastTypes::u32) {
      state->args[r++] = (uint32_t)Local<Integer>::Cast(args[i])->Value();
    } else if (state->param[i] == FastTypes::i32) {
      state->args[r++] = (int32_t)Local<Integer>::Cast(args[i])->Value();
    }
  }
*/
  int r = 1;
  for (int i = 0; i < state->nparam; i++) {
    switch (state->param[i]) {
    // we need to know if the strings are const or not
    // do we always have to copy? how do we clean up?
    // why can't we take the copy on the stack and have it cleaned
    // up automatically?
      case FastTypes::string:
        {
          String::Utf8Value arg0(isolate, args[i]);
          // todo: fix this - never gets freed
//          state->args[r++] = (uint64_t)*arg0;
          state->args[r++] = (uint64_t)strdup(*arg0);
        }
        break;
      case FastTypes::u32:
        state->args[r++] = (uint32_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::u16:
        state->args[r++] = (uint16_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::u8:
        state->args[r++] = (uint8_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::boolean:
        state->args[r++] = (bool)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i32:
        state->args[r++] = (int32_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i16:
        state->args[r++] = (int16_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i8:
        state->args[r++] = (int8_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i64:
      case FastTypes::iSize:
        state->args[r++] = (int64_t)Local<Number>::Cast(args[i])->Value();
        break;
      case FastTypes::u64:
      case FastTypes::pointer:
      case FastTypes::uSize:
        state->args[r++] = (uint64_t)Local<Number>::Cast(args[i])->Value();
        break;
      case FastTypes::buffer:
        {
          Local<Uint8Array> u8 = args[i].As<Uint8Array>();
          state->args[r++] = (uint64_t)((uint8_t*)u8->Buffer()->Data() +
            u8->ByteOffset());
        }
        break;
      case FastTypes::u32array:
        {
          Local<Uint32Array> u32 = args[i].As<Uint32Array>();
          state->args[r++] = (uint64_t)((uint8_t*)u32->Buffer()->Data() +
            u32->ByteOffset());
        }
        break;
      case FastTypes::function:
        break;
      case FastTypes::f32:
        {
          float src = (float)args[i].As<v8::Number>()->Value();
          float* dst = (float*)&state->args[r++];
          *dst = src;
        }
        break;
      case FastTypes::f64:
        {
          //Local<Uint32Array> u32 = args[i].As<Uint32Array>();
          //state->args[r++] = (uint64_t)((uint8_t*)u32->Buffer()->Data() +
          //  u32->ByteOffset());
          double src = (double)args[i].As<v8::Number>()->Value();
          double* dst = (double*)&state->args[r++];
          *dst = src;
        }
        break;
    }
  }
  lo_fastcall(state);
  switch (state->result) {
    case FastTypes::i32:
      args.GetReturnValue().Set((int32_t)state->args[0]);
      break;
    case FastTypes::u32:
      args.GetReturnValue().Set((uint32_t)state->args[0]);
      break;
    case FastTypes::boolean:
      args.GetReturnValue().Set((bool)state->args[0]);
      break;
    case FastTypes::f32:
      {
        float* dst = (float*)&state->args[0];
        args.GetReturnValue().Set(Number::New(isolate, *dst));
      }
      break;
    case FastTypes::f64:
      {
        //double* res = (double*)args[args.Length() - 1]
        //  .As<Uint32Array>()->Buffer()->Data();
        //*res = state->args[0];
        double* dst = (double*)&state->args[0];
        args.GetReturnValue().Set(Number::New(isolate, *dst));
      }
      break;
    case FastTypes::i64:
      {
        int64_t* res = (int64_t*)args[args.Length() - 1]
          .As<Uint32Array>()->Buffer()->Data();
        *res = state->args[0];
      }
      break;
    case FastTypes::buffer:
    case FastTypes::u32array:
    case FastTypes::u64:
    case FastTypes::pointer:
      {
        uint64_t* res = (uint64_t*)args[args.Length() - 1]
          .As<Uint32Array>()->Buffer()->Data();
        *res = state->args[0];
      }
      break;
  }
}

void bind_fastcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  // TODO - does integer work?
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
    Local<Integer>::Cast(args[0])->Value());
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
  data->SetAlignedPointerInInternalField(1, state);
  uint8_t unwrap = needsunwrap((FastTypes)state->result);
  int fastlen = state->nparam + 1 + unwrap;
  CTypeInfo* cargs = (CTypeInfo*)calloc(fastlen, sizeof(CTypeInfo));
  cargs[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  for (int i = 0; i < state->nparam; i++) {
    uint8_t ptype = state->param[i];
    cargs[i + 1] = *CTypeFromV8(ptype);
  }
  CTypeInfo* rc;
  if (unwrap) {
    cargs[fastlen - 1] = *CTypeFromV8(FastTypes::u32array);
    rc = CTypeFromV8(FastTypes::empty);
  } else {
    rc = CTypeFromV8((FastTypes)state->result);
  }
  CFunctionInfo* info = new CFunctionInfo(*rc, fastlen, cargs);
  CFunction* fastCFunc = new CFunction(state->wrapper, info);
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(isolate,
    SlowCallback, data, Local<Signature>(), 0, ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect, fastCFunc
  );
  Local<Function> fun =
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}

void bind_slowcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
    Local<Integer>::Cast(args[0])->Value());
  Local<ObjectTemplate> tpl = ObjectTemplate::New(isolate);
  tpl->SetInternalFieldCount(2);
  Local<Object> data = tpl->NewInstance(context).ToLocalChecked();
  data->SetAlignedPointerInInternalField(1, state);
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(isolate,
    SlowCallback, data, Local<Signature>(), 0, ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect, 0
  );
  Local<Function> fun =
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}

#ifdef __linux__

pid_t vexecve (const char* pathname, char* const argv[], char* const envp[]) {
  pid_t pid = vfork();
  if (pid == 0) {
    int rc = execve(pathname, argv, envp);
    exit(rc);
  }
  if (pid == -1) return pid;
  int status = 0;
  int rc = waitpid(pid, &status, 0);
  if (rc == -1) return rc;
  return status;
}

/*
we can use wait4 with rusage struct to get usage stats on waited process
https://github.com/ziglang/zig/blob/master/lib/std/process/Child.zig#L86
*/
pid_t vfexecve (int fd, char* const argv[], char* const envp[]) {
  pid_t pid = vfork();
  if (pid == 0) {
    int rc = fexecve(fd, argv, envp);
    exit(rc);
  }
  if (pid == -1) return pid;
  int status = 0;
  int rc = waitpid(pid, &status, 0);
  if (rc == -1) return rc;
  return status;
}

#endif
`

// constants that should be defined on the binding
// if we specify a number then that will be used. if a string, then
// it will be checked to see if it represents a variable type. if so, then
// that system constant will be set in the binding at compile time
// todo: we need to define platform for constants too
const constants = {
  S_IFBLK: 'i32', S_IFCHR: 'i32', S_IFIFO: 'i32',
  S_IRUSR: 'i32', S_IWUSR: 'i32', S_IRGRP: 'i32', S_IWGRP: 'i32',
  S_IROTH: 'i32', S_IWOTH: 'i32', O_RDONLY: 'i32', O_WRONLY: 'i32',
  O_CREAT: 'i32', S_IRWXU: 'i32', S_IRWXG: 'i32', S_IXOTH: 'i32',
  O_TRUNC: 'i32', STDIN: 0, STDOUT: 1, STDERR: 2, O_CLOEXEC: 'i32',
  RUSAGE_SELF: 'i32', SEEK_SET: 'i32', SEEK_CUR: 'i32',
  SEEK_END: 'i32', S_IRWXO: 'i32', F_OK: 'i32', S_IFMT: 'i32', S_IFDIR: 'i32',
  S_IFREG: 'i32', NAME_MAX: 'u32', O_RDWR: 'i32', O_SYNC: 'i32',
  O_DIRECTORY: 'i32', F_SETFL: 'i32', O_NONBLOCK: 'i32',
  EAGAIN: 'i32',
  WNOHANG: 'i32', SIGTERM: 'i32',
  MAP_SHARED: 'i32', MAP_ANONYMOUS: 'i32', MAP_PRIVATE: 'i32',
  MS_ASYNC: 'i32', MS_SYNC: 'i32', MS_INVALIDATE: 'i32',
  _SC_CLK_TCK: 'i32',
  F_GETFL: 'i32',
  RTLD_NOW: 'i32', RTLD_LAZY: 'i32', RTLD_GLOBAL: 'i32', RTLD_LOCAL: 'i32',
  RTLD_NODELETE: 'i32', RTLD_NOLOAD: 'i32',
  RTLD_DEFAULT: 'u64', RTLD_NEXT: 'u64',
  PROT_READ: 'i32', PROT_WRITE: 'i32', PROT_EXEC: 'i32', _SC_PAGESIZE: 'i32',
  DT_BLK: 'i32',
  DT_CHR: 'i32',
  DT_DIR: 'i32',
  DT_FIFO: 'i32',
  DT_LNK: 'i32',
  DT_REG: 'i32',
  DT_SOCK: 'i32',
  DT_UNKNOWN: 'i32',
}

const structs = ['clock_t', 'fastcall']

// list of headers to include
const includes = [
  'unistd.h', 'sys/stat.h', 'fcntl.h', 'dirent.h', 'dlfcn.h', 'sys/mman.h',
  'stdio.h', 'sys/wait.h', 'signal.h', 'sys/resource.h', 'sys/times.h', 'sys/reboot.h',
  'string.h', 'termios.h'
]

// i think this is cleanest way to do this for now. would be nice to come up 
// with a matrix of all syscalls for all environments and generate them automatically
const mac = {
  constants: {
    RTLD_FIRST: 'i32',
    RTLD_SELF: 'i64',
    RTLD_MAIN_ONLY: 'i64',
    MAP_JIT: 'i32'
  }
}

const linux = {
  constants: {
    LINUX_REBOOT_CMD_HALT: 'u32',
    LINUX_REBOOT_CMD_POWER_OFF: 'u32',
    LINUX_REBOOT_CMD_RESTART: 'u32',
    RB_POWER_OFF: 'i32',
    EINTR: 'i32',
    MFD_CLOEXEC: 'i32',
    MAP_HUGETLB: 'i32',
    MAP_HUGE_SHIFT: 'i32',
    MFD_HUGETLB: 'i32',
//    MAP_32BIT: 'i32', // this breaks arm64/linux build, even with -D_GNU_SOURCE defined
    MADV_HUGEPAGE: 'i32',
    MAP_FIXED: 'i32',
    POSIX_FADV_SEQUENTIAL: 'i32', POSIX_FADV_WILLNEED: 'i32', POSIX_FADV_RANDOM: 'i32',
    POSIX_FADV_DONTNEED: 'i32'
  },
  includes: [
    'linux/reboot.h',
    'sys/ioctl.h',
    'dirent.h',
    'sched.h'
  ],
  api: {
    posix_fadvise: {
      parameters: ['i32', 'u32', 'u32', 'i32'],
      result: 'i32'
    },
    ioctl: {
      parameters: ['i32', 'u32', 'buffer'],
      result: 'i32',
    },
    ioctl2: {
      parameters: ['i32', 'u32', 'i32'],
      result: 'i32',
      name: 'ioctl',
    },
    ioctl3: {
      parameters: ['i32', 'u32', 'pointer'],
      result: 'i32',
      name: 'ioctl',
    },
    reboot: {
      parameters: ['i32'],
      result: 'i32',
    },
    getdents: {
      parameters: ['i32', 'pointer', 'u32'],
      result: 'u32',
      name: 'getdents64',
    },
    getaffinity: {
      parameters: ['i32', 'u32', 'pointer'],
      pointers: [, , 'cpu_set_t*'],
      result: 'i32',
      name: 'sched_getaffinity',
    },
    copy_file_range: {
      parameters: ['i32', 'pointer', 'i32', 'pointer', 'u32', 'u32'],
      pointers: [, 'loff_t*', , 'loff_t*'],
      result: 'u32',
    },
    memfd_create: {
      parameters: ['string', 'u32'],
      result: 'i32',
      man: 'https://man7.org/linux/man-pages/man2/memfd_create.2.html'
    },
    setaffinity: {
      parameters: ['i32', 'u32', 'pointer'],
      pointers: [, , 'cpu_set_t*'],
      result: 'i32',
      name: 'sched_setaffinity',
    },
    vfork: {
      parameters: [],
      result: 'i32'
    },
    vexecve: {
      parameters: ['string', 'buffer', 'buffer'],
      pointers: ['const char*', 'char* const*', 'char* const*'],
      result: 'i32',
    },
    vfexecve: {
      parameters: ['i32', 'buffer', 'buffer'],
      pointers: [, 'char* const*', 'char* const*'],
      result: 'i32',
    },
    getpagesize: {
      parameters: [],
      result: 'i32'
    },
    madvise: {
      parameters: ['pointer', 'u32', 'i32'],
      result: 'i32'
    }
  },
  structs: ['cpu_set_t']
}

// binding name
const name = 'core'
// system available libraries that need to be linked dynamically
const libs = ['dl'] // i.e. '-ldl' flag to gnu linker
// list of object files that should be linked into the library
const obj = []

export {
  api, includes, name, libs, obj, constants, preamble, structs,
  linux, mac
}

