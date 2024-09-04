#if defined(_WIN64)
#include "main_win.h"
#else
#include "main.h"
#endif

#include <fcntl.h>

int main(int argc, char** argv) {
  // if we are called with no arguments, just dump the version and exit
  if (argc == 2 && strncmp(argv[1], "--version", 9) == 0) {
    fprintf(stdout, "%s\n", VERSION);
    return 0;
  }
  // record the start time - this will be made available to JS so we can 
  // measure time to bootstrap the runtime
  uint64_t starttime = lo::hrtime();
  // turn off buffering of stdout and stderr - this is required by V8
  // https://en.cppreference.com/w/c/io/setvbuf
  setvbuf(stdout, nullptr, _IONBF, 0);
  setvbuf(stderr, nullptr, _IONBF, 0);

  lo::Setup(&argc, argv, v8flags, _v8_threads, _v8flags_from_commandline);

  // register any builtins and modules that have been generated in main.h 
  register_builtins();
  // create a new isolate on the main thread. this will block until the 
  // isolate exits
  lo::CreateIsolate(argc, argv, main_js, main_js_len, index_js, index_js_len, 0,
    0, 0, starttime, RUNTIME, "main.js", _v8_cleanup, _on_exit, nullptr);

  lo_shutdown(_v8_cleanup);
  return 0;
}
