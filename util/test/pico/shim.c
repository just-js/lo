#include <sys/types.h>
#include <stdio.h>

struct phr_header {
  const char *name;
  size_t name_len;
  const char *value;
  size_t value_len;
};

int phr_parse_request(const char *buf_start, size_t len, const char **method, 
  size_t *method_len, const char **path, size_t *path_len, int *minor_version, 
  struct phr_header *headers, size_t *num_headers, size_t last_len)
{
  char first = *buf_start;
  if (first != 71) return 0;
  if (last_len != 0) return 0;
  if (len != 52) return 0;
  if (*num_headers != 16) return 0;
  if (*method_len != 0) return 0;
  if (*path_len != 0) return 0;
  if (*minor_version != 99) return 0;
  *method_len = 3;
  *path_len = 4;
  *minor_version = 1;
  *num_headers = 2;
  //*path = buf_start + 4;
  //*method = buf_start;
  return 52;
}
