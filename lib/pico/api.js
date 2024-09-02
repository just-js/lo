const api = {
  parseRequest: {
    parameters: ['buffer', 'u32', 'buffer'],
    pointers: ['char*', ,'httpRequest*'],
    result: 'i32',
    name: 'parse_request'
  },
  parseRequest2: {
    parameters: ['pointer', 'u32', 'pointer'],
    pointers: ['char*', ,'httpRequest*'],
    result: 'i32',
    name: 'parse_request'
  },
  parseResponse: {
    parameters: ['buffer', 'u32', 'buffer'],
    pointers: ['char*', ,'httpResponse*'],
    result: 'i32',
    name: 'parse_response'
  },
  parseResponse2: {
    parameters: ['pointer', 'u32', 'pointer'],
    pointers: ['char*', ,'httpResponse*'],
    result: 'i32',
    name: 'parse_response'
  },
/*
int phr_parse_request(const char *buf, size_t len, const char **method,
  size_t *method_len, const char **path, size_t *path_len, int *minor_version,
  struct phr_header *headers, size_t *num_headers, size_t last_len);

int phr_parse_response(const char *_buf, size_t len, int *minor_version,
  int *status, const char **msg, size_t *msg_len, struct phr_header *headers,
  size_t *num_headers, size_t last_len);
*/
  parse_request: {
    parameters: [
      'pointer', 'u32', 'pointer', 'pointer', 'pointer', 'pointer',
      'pointer', 'pointer', 'pointer', 'u64'
    ],
    pointers: [
      'const char*', ,'const char **', 'size_t *', 'const char **', 'size_t *',
      'int*', 'struct phr_header *', 'size_t *'
    ],
    result: 'i32',
    name: 'phr_parse_request'
  },
  parse_response: {
    parameters: [
      'pointer', 'u32', 'pointer', 'pointer', 'pointer', 'pointer',
      'pointer', 'pointer', 'u32'
    ],
    pointers: [
      'const char*', ,'int *', 'int *', 'const char **', 'size_t *',
      'struct phr_header *', 'size_t *'
    ],
    result: 'i32',
    name: 'phr_parse_response'
  },
  decode_chunked: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['struct phr_chunked_decoder *', 'char*', 'size_t*'],
    result: 'i32',
    name: 'phr_decode_chunked'
  }
}

const name = 'pico'
const includes = ['picohttpparser.h']
const obj = ['picohttpparser.o', 'pico.a']

const preamble = `
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

// todo: read multiple headers in a single call - for pipelined
// todo: spec compliance checks
// todo: chunked parsing
int parse_request(char* next, ssize_t bytes, httpRequest* req) {
  const char* method;
  const char* path;
  struct phr_header headers[JUST_MAX_HEADERS];
  req->num_headers = JUST_MAX_HEADERS;
  int nread = phr_parse_request(next, bytes,
    (const char **)&method,
    &req->method_len, (const char **)&path,
    &req->path_len, &req->minor_version, headers,
    &req->num_headers, 0);
  for (uint32_t i = 0; i < req->num_headers; i++) {
    req->headers[i].name_start = (uint64_t)headers[i].name - (uint64_t)next;
    req->headers[i].name_len = headers[i].name_len;
    req->headers[i].value_start = (uint64_t)headers[i].value - (uint64_t)next;
    req->headers[i].value_len = headers[i].value_len;
  }
  return nread;
}

int parse_response(char* next, ssize_t bytes, httpResponse* res) {
  const char* status_message;
  struct phr_header headers[JUST_MAX_HEADERS];
  res->num_headers = JUST_MAX_HEADERS;
  int nread = phr_parse_response(next, bytes,
    &res->minor_version, &res->status_code,
    (const char **)&status_message,
    &res->status_message_len, headers,
    &res->num_headers, 0);
  for (uint32_t i = 0; i < res->num_headers; i++) {
    res->headers[i].name_start = (uint64_t)headers[i].name - (uint64_t)next;
    res->headers[i].name_len = headers[i].name_len;
    res->headers[i].value_start = (uint64_t)headers[i].value - (uint64_t)next;
    res->headers[i].value_len = headers[i].value_len;
  }
  return nread;
}

`

const structs = ['phr_chunked_decoder']
export { name, api, includes, obj, preamble, structs }
