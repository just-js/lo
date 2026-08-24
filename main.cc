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
  // build-time only: produce a V8 startup snapshot of this binary's own
  // main_js (definitions only - see lo::CreateSnapshot/PLAN.md task 64)
  // instead of running normally. build_runtime() invokes this on the
  // freshly-linked binary, then re-links a second time embedding the
  // resulting blob - never reached by a real deployed run.
  if ((argc == 3 || argc == 4) &&
      strncmp(argv[1], "--build-snapshot", 16) == 0) {
    int keep_code = (argc == 4 && strncmp(argv[3], "--keep", 6) == 0) ? 1 : 0;
    lo::Setup(&argc, argv, v8flags, _v8_threads, _v8flags_from_commandline);
    register_builtins();
    // main.js's own dispatch reads args.length to decide whether to run
    // a real command - the real --build-snapshot/out-path argv means
    // nothing to it and was making it try to actually execute
    // "--build-snapshot" as a user command during the build pass
    // (chasing unrelated bindings like epoll/system as a result, a real
    // symptom hit and root-caused live, not guessed). Pass a single,
    // benign argv[0] instead, so args.length === 1 takes the harmless
    // show_usage() branch.
    int snapshot_argc = 1;
    char* snapshot_argv[1] = { argv[0] };
    return lo::CreateSnapshot(main_js, main_js_len, argv[2], keep_code,
      snapshot_argc, snapshot_argv);
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
    0, 0, starttime, RUNTIME, "main.js", _v8_cleanup, _on_exit,
    (void*)lo_snapshot_data);

  lo_shutdown(_v8_cleanup);
  return 0;
}
