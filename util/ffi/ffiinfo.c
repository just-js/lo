#include <ffi.h>
#include <string.h>
#include <stdint.h>

struct FastApiTypedArray {
  uintptr_t length_;
  void* data;
};

void ffi_info (struct FastApiTypedArray* u8) {
  ffi_type* types = (ffi_type*)u8;
  memcpy(types, &ffi_type_uint8, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_uint8;
  types++;
  memcpy(types, &ffi_type_sint8, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_sint8;
  types++;
  memcpy(types, &ffi_type_uint16, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_uint16;
  types++;
  memcpy(types, &ffi_type_sint16, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_sint16;
  types++;
  memcpy(types, &ffi_type_uint32, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_uint32;
  types++;
  memcpy(types, &ffi_type_sint32, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_sint32;
  types++;
  memcpy(types, &ffi_type_uint64, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_uint64;
  types++;
  memcpy(types, &ffi_type_sint64, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_sint64;
  types++;
  memcpy(types, &ffi_type_float, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_float;
  types++;
  memcpy(types, &ffi_type_double, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_double;
  types++;
  memcpy(types, &ffi_type_pointer, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_pointer;
  types++;
  memcpy(types, &ffi_type_void, sizeof(ffi_type));
  *((uint64_t*)types + 2) = (uint64_t)&ffi_type_void;
  types++;
}
