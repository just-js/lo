// v8/libv8_monolith.a (just-js/v8's prebuilt release) is built against glibc.
// musl's own libc calls are already 64-bit (no separate LFS64 variants), so
// the *64 names below are pure aliases - on x86_64 the glibc structs/types
// they take (rlimit64/stat64/off_t) are binary-identical to musl's, so a
// thin passthrough is layout-safe. The __*_chk functions are glibc's
// _FORTIFY_SOURCE variants; we skip the extra bounds checking and just
// forward to the unchecked call. musl has no execinfo.h at all, so
// backtrace()/backtrace_symbols*() are stubbed to report zero frames - V8
// only calls these for crash/debug stack-trace printing, so this just means
// that diagnostic feature prints nothing. __libc_stack_end is a glibc CRT
// global with no musl equivalent; best-effort init via pthread_getattr_np.
// __libc_single_threaded is fixed at 0 (never single-threaded) - always
// takes the safe synchronized path, never the fast-path shortcut it gates.

#define _GNU_SOURCE
#include <sys/resource.h>
#include <sys/stat.h>
#include <sys/mman.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <pthread.h>

int getrlimit64(int resource, struct rlimit *rlim) {
  return getrlimit(resource, rlim);
}

int stat64(const char *path, struct stat *buf) {
  return stat(path, buf);
}

int mkstemp64(char *template_) {
  return mkstemp(template_);
}

FILE *tmpfile64(void) {
  return tmpfile();
}

FILE *fopen64(const char *path, const char *mode) {
  return fopen(path, mode);
}

int fstat64(int fd, struct stat *buf) {
  return fstat(fd, buf);
}

int ftruncate64(int fd, off_t length) {
  return ftruncate(fd, length);
}

void *mmap64(void *addr, size_t len, int prot, int flags, int fd, off_t offset) {
  return mmap(addr, len, prot, flags, fd, offset);
}

int open64(const char *path, int flags, ...) {
  mode_t mode = 0;
  if (flags & O_CREAT) {
    va_list ap;
    va_start(ap, flags);
    mode = va_arg(ap, mode_t);
    va_end(ap);
  }
  return open(path, flags, mode);
}

long __sysconf(int name) {
  return sysconf(name);
}

int __vfprintf_chk(FILE *stream, int flag, const char *format, va_list ap) {
  (void)flag;
  return vfprintf(stream, format, ap);
}

int __vsnprintf_chk(char *s, size_t maxlen, int flag, size_t slen, const char *format, va_list ap) {
  (void)flag;
  (void)slen;
  return vsnprintf(s, maxlen, format, ap);
}

void *__memcpy_chk(void *dest, const void *src, size_t len, size_t destlen) {
  (void)destlen;
  return memcpy(dest, src, len);
}

_Bool __libc_single_threaded = 0;

int backtrace(void **buffer, int size) {
  (void)buffer;
  (void)size;
  return 0;
}

char **backtrace_symbols(void *const *buffer, int size) {
  (void)buffer;
  (void)size;
  return NULL;
}

void backtrace_symbols_fd(void *const *buffer, int size, int fd) {
  (void)buffer;
  (void)size;
  (void)fd;
}

void *__libc_stack_end;

__attribute__((constructor)) static void init_libc_stack_end(void) {
  pthread_attr_t attr;
  if (pthread_getattr_np(pthread_self(), &attr) == 0) {
    void *stackaddr;
    size_t stacksize;
    if (pthread_attr_getstack(&attr, &stackaddr, &stacksize) == 0) {
      __libc_stack_end = (char *)stackaddr + stacksize;
    }
    pthread_attr_destroy(&attr);
  }
}
