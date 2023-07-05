// gcc -O3 -march=native -mtune=native -shared -rdynamic -fPIC -o bug.so bug.c
#include <stdio.h>

void noop () {

}

int add1 (int a) {
  if (a != 1) return -1;
  return a + a;
}

int add2 (int a, int b) {
  if (a != 1) return -1;
  if (b != 2) return -1;
  return a + b;
}

int add3 (int a, int b, int c) {
  if (a != 1) return -1;
  if (b != 2) return -1;
  if (c != 3) return -1;
  return a + b + c;
}

int add4 (int a, int b, int c, int d) {
  if (a != 1) return -1;
  if (b != 2) return -1;
  if (c != 3) return -1;
  if (d != 4) return -1;
  return a + b + c + d;
}

int add5 (int a, int b, int c, int d, int e) {
  if (a != 1) return -1;
  if (b != 2) return -1;
  if (c != 3) return -1;
  if (d != 4) return -1;
  if (e != 5) return -1;
  return a + b + c + d + e;
}

int add6 (int a, int b, int c, int d, int e, int f) {
  if (a != 1) return -1;
  if (b != 2) return -1;
  if (c != 3) return -1;
  if (d != 4) return -1;
  if (e != 5) return -1;
  if (f != 6) return -1;
  return a + b + c + d + e + f;
}

int add7 (int a, int b, int c, int d, int e, int f, int g) {
  if (a != 1) return -1;
  if (b != 2) return -1;
  if (c != 3) return -1;
  if (d != 4) return -1;
  if (e != 5) return -1;
  if (f != 6) return -1;
  if (g != 7) return -1;
  return a + b + c + d + e + f + g;
}

int add8 (int a, int b, int c, int d, int e, int f, int g, int h) {
  if (a != 1) return -1;
  if (b != 2) return -1;
  if (c != 3) return -1;
  if (d != 4) return -1;
  if (e != 5) return -1;
  if (f != 6) return -1;
  if (g != 7) return -1;
  if (h != 8) return -1;
  return a + b + c + d + e + f + g + h;
}

int add9 (int a, int b, int c, int d, int e, int f, int g, int h, int i) {
  if (a != 1) return -1;
  if (b != 2) return -1;
  if (c != 3) return -1;
  if (d != 4) return -1;
  if (e != 5) return -1;
  if (f != 6) return -1;
  if (g != 7) return -1;
  if (h != 8) return -1;
  if (i != 9) return -1;
  return a + b + c + d + e + f + g + h + i;
}

int add10 (int a, int b, int c, int d, int e, int f, int g, int h, int i, int j) {
  if (a != 1) return -1;
  if (b != 2) return -1;
  if (c != 3) return -1;
  if (d != 4) return -1;
  if (e != 5) return -1;
  if (f != 6) return -1;
  if (g != 7) return -1;
  if (h != 8) return -1;
  if (i != 9) return -1;
  if (j != 10) return -1;
  return a + b + c + d + e + f + g + h + i + j;
}

int add11 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k
) {
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  return a + b + c + d + e + f + g + h + i + j + k;
}

int add12 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k, int l
) {
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  if (l != 12) return -12;
  return a + b + c + d + e + f + g + h + i + j + k + l;
}

int add13 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k, int l, int m
) {
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  if (l != 12) return -12;
  if (m != 13) return -13;
  return a + b + c + d + e + f + g + h + i + j + k + l + m;
}

int add14 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k, int l, int m, int n
) {
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  if (l != 12) return -12;
  if (m != 13) return -13;
  if (n != 14) return -14;
  return a + b + c + d + e + f + g + h + i + j + k + l + m + n;
}

int add15 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k, int l, int m, int n, int o
) {
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  if (l != 12) return -12;
  if (m != 13) return -13;
  if (n != 14) return -14;
  if (o != 15) return -15;
  return a + b + c + d + e + f + g + h + i + j + k + l + m + n + o;
}

int add16 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k, int l, int m, int n, int o, int p
) {
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  if (l != 12) return -12;
  if (m != 13) return -13;
  if (n != 14) return -14;
  if (o != 15) return -15;
  if (p != 16) return -16;
  return a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p;
}

int add17 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k, int l, int m, int n, int o, int p, int q
) {
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  if (l != 12) return -12;
  if (m != 13) return -13;
  if (n != 14) return -14;
  if (o != 15) return -15;
  if (p != 16) return -16;
  if (q != 17) return -17;
  return a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q;
}

int add18 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k, int l, int m, int n, int o, int p, int q, int r
) {
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  if (l != 12) return -12;
  if (m != 13) return -13;
  if (n != 14) return -14;
  if (o != 15) return -15;
  if (p != 16) return -16;
  if (q != 17) return -17;
  if (r != 18) return -18;
  return a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r;
}

int add19 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k, int l, int m, int n, int o, int p, int q, int r, int s
) {
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  if (l != 12) return -12;
  if (m != 13) return -13;
  if (n != 14) return -14;
  if (o != 15) return -15;
  if (p != 16) return -16;
  if (q != 17) return -17;
  if (r != 18) return -18;
  if (s != 19) return -19;
  return a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s;
}

int add20 (
  int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, 
  int k, int l, int m, int n, int o, int p, int q, int r, int s, int t
) {
  //fprintf(stderr, "%i %i %i %i %i %i %i %i %i %i %i %i %i %i %i %i %i %i %i %i\n", a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t);
  if (a != 1) return -1;
  if (b != 2) return -2;
  if (c != 3) return -3;
  if (d != 4) return -4;
  if (e != 5) return -5;
  if (f != 6) return -6;
  if (g != 7) return -7;
  if (h != 8) return -8;
  if (i != 9) return -9;
  if (j != 10) return -10;
  if (k != 11) return -11;
  if (l != 12) return -12;
  if (m != 13) return -13;
  if (n != 14) return -14;
  if (o != 15) return -15;
  if (p != 16) return -16;
  if (q != 17) return -17;
  if (r != 18) return -18;
  if (s != 19) return -19;
  if (t != 20) return -20;
  return a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s + t;
}
