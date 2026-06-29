#include <stdlib.h>

#define DLL_PUBLIC __attribute__ ((visibility ("default")))

typedef unsigned int (*callback)(unsigned int);

unsigned int counter = 0;

DLL_PUBLIC unsigned int test(callback cb) {
  counter = cb(counter);
  return counter;
}

DLL_PUBLIC int sum (int a, int b) {
  return a + b;
}
