// plain C entry points over simdjson's C++ API, for lib/simdjson/api.js
#include "simdjson.h"
#include "escape.h"
#include <string.h>

// one reused builder: escape_and_append() finds the characters to escape with
// the SIMD kernel simdjson picked for this CPU; the result is copied out
size_t lo_simdjson_escape_into (char* dst, const char* src, size_t len) {
  static thread_local simdjson::builder::string_builder sb(4096);
  sb.clear();
  sb.escape_and_append(std::string_view(src, len));
  size_t n = sb.size();
  memcpy(dst, sb.unsafe_data(), n);
  return n;
}
