#include "pico.h"

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
