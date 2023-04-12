#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include "picohttpparser.h"

#define JUST_MAX_HEADERS 14

typedef struct httpHeader httpHeader;
struct httpHeader {
  uint32_t name_start;
  uint32_t name_len;
  uint32_t value_start;
  uint32_t value_len;
};

typedef struct httpRequest httpRequest;
struct httpRequest {
  size_t path_len;
  size_t method_len;
  size_t num_headers;
  int32_t minor_version;
  uint8_t padding[4];
  struct httpHeader headers[JUST_MAX_HEADERS];
};

typedef struct httpResponse httpResponse;
struct httpResponse {
  int32_t minor_version;
  int32_t status_code;
  size_t num_headers;
  size_t status_message_len;
  uint8_t padding[8];
  struct httpHeader headers[JUST_MAX_HEADERS];
};


#ifdef __cplusplus
extern "C" {
#endif

int parse_request(char* next, ssize_t bytes, httpRequest* req);
int parse_response(char* next, ssize_t bytes, httpResponse* res);
// we can do the routing inside c++ if we pre-define the routes
#ifdef __cplusplus
}
#endif