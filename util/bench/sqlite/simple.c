#include <sqlite3.h>
#include <stdio.h>
#include <time.h>

/* 
spin is roughtly 3.33% slower than

gcc -O3 -o test test.c -lsqlite3

LD_PRELOAD=./libsqlite3.so taskset --cpu-list 0 ./test

10000000 in 1.47 s 6810260 rps 147 ns/op

LD_PRELOAD=./libsqlite3.so taskset --cpu-list 0 ./spin util/bench/sqlite/simple.js

pragma user_version   1520 ms rate    6575908 ns/iter     152.00

*/

int get_version (sqlite3_stmt* stmt) {
  if (sqlite3_step(stmt) == SQLITE_ROW) {
    int val = sqlite3_column_int(stmt, 0);
    sqlite3_reset(stmt);
    return val;
  }
  sqlite3_finalize(stmt);
  return 0;
}

void bench (sqlite3_stmt* stmt) {
  float start, end;
  unsigned int count = 10000000;
  start = (float)clock() / CLOCKS_PER_SEC;
  for (unsigned int i = 0; i < count; i++) get_version(stmt);
  end = (float)clock() / CLOCKS_PER_SEC;
  float elapsed = end - start;
  float rate = count / elapsed;
  float nanos = (1000000000.0 / rate);
  printf("%u in %.2f s %.0f rps %.0f ns/op\n", count, elapsed, rate, nanos);
}

int main () {
  sqlite3* db;
  int flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_NOMUTEX | SQLITE_OPEN_CREATE;
  sqlite3_open_v2(":memory:", &db, flags, NULL);
  sqlite3_stmt* stmt;
  sqlite3_prepare_v2(db, "pragma user_version", -1, &stmt, 0);
  char *err_msg = 0;
  //sqlite3_exec(db, "PRAGMA auto_vacuum = none", 0, 0, &err_msg);
  //sqlite3_exec(db, "PRAGMA temp_store = memory", 0, 0, &err_msg);
  //sqlite3_exec(db, "PRAGMA locking_mode = exclusive", 0, 0, &err_msg);
  sqlite3_exec(db, "PRAGMA user_version = 100", 0, 0, &err_msg);
  while (1) bench(stmt);
  sqlite3_finalize(stmt);
  sqlite3_close(db);
}
