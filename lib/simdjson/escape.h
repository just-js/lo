#pragma once
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif
size_t lo_simdjson_escape_into (char* dst, const char* src, size_t len);
#ifdef __cplusplus
}
#endif
