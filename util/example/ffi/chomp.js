import { Library, Types, tcc, bindFastApi } from 'lib/ffi.js'

// generate a fast api + ffi binding for a syscall we can look up with dlsym
const libc = (new Library()).open().bind({
  read: {
    parameters: ['i32', 'buffer', 'u32'],
    result: 'i32'
  }
})

const CSource = `
#include <unistd.h>
#include <asm/unistd.h>
#include <errno.h>

int ffi_read (int fd, const void *buf, size_t size) {
  int ret;
  asm volatile
  (
    "syscall"
    : "=a" (ret)
    : "0"(0), "D"(fd), "S"(buf), "d"(size), "r"(0), "m"(0), "m"(0)
    : "rcx", "r11", "memory"
  );
  if (ret < 0) {
    errno = -ret;
    return -1;
  };
  return ret;
}
`
// generate a fast api + ffi binding for an on-the-fly compiled C function
const asm = (new Library()).open().compile(CSource).bind({
  read: {
    parameters: ['i32', 'buffer', 'u32'],
    result: 'i32',
    name: 'ffi_read',
    internal: true
  }
})

const CSource2 = `
#include <unistd.h>
#include <errno.h>

typedef int int32_t;

struct FastApiTypedArray {
  uintptr_t length_;
  void* data;
};

int32_t ffi_read_slow (int32_t fd, void* p_buf) {
  return read(fd, p_buf, 65536);
}

int32_t ffi_read (void* recv, int32_t fd, struct FastApiTypedArray* const p_buf) {
  int32_t ret;
  asm volatile
  (
    "syscall"
    : "=a" (ret)
    : "0"(0), "D"(fd), "S"(p_buf->data), "d"(p_buf->length_), "r"(0), "m"(0), "m"(0)
    : "rcx", "r11", "memory"
  );
  if (ret < 0) {
    errno = -ret;
    return -1;
  };
  return ret;
}
`

// generate the fast api call wrapper directly
const encoder = new TextEncoder()
const CSourceb = spin.ptr(encoder.encode(CSource2))
const TCC_OUTPUT_MEMORY = 1
const TCC_RELOCATE_AUTO = 1
const code = tcc.tcc_new()
tcc.tcc_set_output_type(code, TCC_OUTPUT_MEMORY)
let rc = tcc.tcc_compile_string(code, CSourceb.ptr)
spin.assert(rc === 0, `could not compile (${rc})`)
rc = tcc.tcc_relocate(code, TCC_RELOCATE_AUTO)
spin.assert(rc === 0, `could not relocate (${rc})`)
const addr = tcc.tcc_get_symbol(code, spin.cstr('ffi_read').ptr)
spin.assert(addr, `could not locate symbol`)
const sym = tcc.tcc_get_symbol(code, spin.cstr('ffi_read_slow').ptr)
spin.assert(sym, `could not locate symbol`)
const read3 = bindFastApi(sym, addr, Types.i32, [Types.i32, Types.buffer])

const u8 = new Uint8Array(65536)
let total = 0

function ffi_read () {
  const read = read3
  let bytes = read(0, u8)
  while (bytes > 0) {
    total += bytes
    bytes = read(0, u8)
  }
  console.log(total)
}

function asm_read () {
  const size = u8.length
  const read = asm.read  
  let bytes = read(0, u8, size)
  while (bytes > 0) {
    total += bytes
    bytes = read(0, u8, size)
  }
  console.log(total)  
}

ffi_read()
