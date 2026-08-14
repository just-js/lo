// tiny native lib for core-test.js's dlopen/dlsym round trip -
// same shape as LO.md's ffi-demo.js/add.c, compiled into core-test.so
int add(int a, int b) { return a + b; }
