#pragma once
// [do not edit,<auto-generated />]
// This file has been automatically generated, please do not change unless you disable auto-generation in the Makefile

#include "lo.h"

extern char _binary_main_js_start[];
extern char _binary_main_js_end[];
static unsigned int main_js_len = _binary_main_js_end - _binary_main_js_start;
extern char _binary_Makefile_start[];
extern char _binary_Makefile_end[];
extern char _binary_main_cc_start[];
extern char _binary_main_cc_end[];
extern char _binary_lo_cc_start[];
extern char _binary_lo_cc_end[];
extern char _binary_lo_h_start[];
extern char _binary_lo_h_end[];
extern char _binary_globals_d_ts_start[];
extern char _binary_globals_d_ts_end[];
extern char _binary_jsconfig_json_start[];
extern char _binary_jsconfig_json_end[];
extern char _binary_lib_core_api_js_start[];
extern char _binary_lib_core_api_js_end[];
extern char _binary_lib_curl_api_js_start[];
extern char _binary_lib_curl_api_js_end[];
extern char _binary_lib_libssl_api_js_start[];
extern char _binary_lib_libssl_api_js_end[];
extern char _binary_lib_pthread_api_js_start[];
extern char _binary_lib_pthread_api_js_end[];
extern char _binary_lib_sqlite_api_js_start[];
extern char _binary_lib_sqlite_api_js_end[];
extern char _binary_lib_zlib_api_js_start[];
extern char _binary_lib_zlib_api_js_end[];
extern char _binary_lib_asm_js_start[];
extern char _binary_lib_asm_js_end[];
extern char _binary_lib_bench_js_start[];
extern char _binary_lib_bench_js_end[];
extern char _binary_lib_binary_js_start[];
extern char _binary_lib_binary_js_end[];
extern char _binary_lib_curl_js_start[];
extern char _binary_lib_curl_js_end[];
extern char _binary_lib_ffi_js_start[];
extern char _binary_lib_ffi_js_end[];
extern char _binary_lib_fs_js_start[];
extern char _binary_lib_fs_js_end[];
extern char _binary_lib_gen_js_start[];
extern char _binary_lib_gen_js_end[];
extern char _binary_lib_libssl_js_start[];
extern char _binary_lib_libssl_js_end[];
extern char _binary_lib_path_js_start[];
extern char _binary_lib_path_js_end[];
extern char _binary_lib_proc_js_start[];
extern char _binary_lib_proc_js_end[];
extern char _binary_lib_repl_js_start[];
extern char _binary_lib_repl_js_end[];
extern char _binary_lib_sqlite_js_start[];
extern char _binary_lib_sqlite_js_end[];
extern char _binary_lib_untar_js_start[];
extern char _binary_lib_untar_js_end[];
extern char _binary_lib_zlib_js_start[];
extern char _binary_lib_zlib_js_end[];

extern "C" {
  extern void* _register_core();
  extern void* _register_curl();
  extern void* _register_libssl();
  extern void* _register_pthread();
  extern void* _register_sqlite();
  extern void* _register_zlib();
}

void register_builtins() {
  lo::builtins_add("main.js", _binary_main_js_start, _binary_main_js_end - _binary_main_js_start);
  lo::builtins_add("Makefile", _binary_Makefile_start, _binary_Makefile_end - _binary_Makefile_start);
  lo::builtins_add("main.cc", _binary_main_cc_start, _binary_main_cc_end - _binary_main_cc_start);
  lo::builtins_add("lo.cc", _binary_lo_cc_start, _binary_lo_cc_end - _binary_lo_cc_start);
  lo::builtins_add("lo.h", _binary_lo_h_start, _binary_lo_h_end - _binary_lo_h_start);
  lo::builtins_add("globals.d.ts", _binary_globals_d_ts_start, _binary_globals_d_ts_end - _binary_globals_d_ts_start);
  lo::builtins_add("jsconfig.json", _binary_jsconfig_json_start, _binary_jsconfig_json_end - _binary_jsconfig_json_start);
  lo::builtins_add("lib/core/api.js", _binary_lib_core_api_js_start, _binary_lib_core_api_js_end - _binary_lib_core_api_js_start);
  lo::builtins_add("lib/curl/api.js", _binary_lib_curl_api_js_start, _binary_lib_curl_api_js_end - _binary_lib_curl_api_js_start);
  lo::builtins_add("lib/libssl/api.js", _binary_lib_libssl_api_js_start, _binary_lib_libssl_api_js_end - _binary_lib_libssl_api_js_start);
  lo::builtins_add("lib/pthread/api.js", _binary_lib_pthread_api_js_start, _binary_lib_pthread_api_js_end - _binary_lib_pthread_api_js_start);
  lo::builtins_add("lib/sqlite/api.js", _binary_lib_sqlite_api_js_start, _binary_lib_sqlite_api_js_end - _binary_lib_sqlite_api_js_start);
  lo::builtins_add("lib/zlib/api.js", _binary_lib_zlib_api_js_start, _binary_lib_zlib_api_js_end - _binary_lib_zlib_api_js_start);
  lo::builtins_add("lib/asm.js", _binary_lib_asm_js_start, _binary_lib_asm_js_end - _binary_lib_asm_js_start);
  lo::builtins_add("lib/bench.js", _binary_lib_bench_js_start, _binary_lib_bench_js_end - _binary_lib_bench_js_start);
  lo::builtins_add("lib/binary.js", _binary_lib_binary_js_start, _binary_lib_binary_js_end - _binary_lib_binary_js_start);
  lo::builtins_add("lib/curl.js", _binary_lib_curl_js_start, _binary_lib_curl_js_end - _binary_lib_curl_js_start);
  lo::builtins_add("lib/ffi.js", _binary_lib_ffi_js_start, _binary_lib_ffi_js_end - _binary_lib_ffi_js_start);
  lo::builtins_add("lib/fs.js", _binary_lib_fs_js_start, _binary_lib_fs_js_end - _binary_lib_fs_js_start);
  lo::builtins_add("lib/gen.js", _binary_lib_gen_js_start, _binary_lib_gen_js_end - _binary_lib_gen_js_start);
  lo::builtins_add("lib/libssl.js", _binary_lib_libssl_js_start, _binary_lib_libssl_js_end - _binary_lib_libssl_js_start);
  lo::builtins_add("lib/path.js", _binary_lib_path_js_start, _binary_lib_path_js_end - _binary_lib_path_js_start);
  lo::builtins_add("lib/proc.js", _binary_lib_proc_js_start, _binary_lib_proc_js_end - _binary_lib_proc_js_start);
  lo::builtins_add("lib/repl.js", _binary_lib_repl_js_start, _binary_lib_repl_js_end - _binary_lib_repl_js_start);
  lo::builtins_add("lib/sqlite.js", _binary_lib_sqlite_js_start, _binary_lib_sqlite_js_end - _binary_lib_sqlite_js_start);
  lo::builtins_add("lib/untar.js", _binary_lib_untar_js_start, _binary_lib_untar_js_end - _binary_lib_untar_js_start);
  lo::builtins_add("lib/zlib.js", _binary_lib_zlib_js_start, _binary_lib_zlib_js_end - _binary_lib_zlib_js_start);
  lo::modules_add("core", &_register_core);
  lo::modules_add("curl", &_register_curl);
  lo::modules_add("libssl", &_register_libssl);
  lo::modules_add("pthread", &_register_pthread);
  lo::modules_add("sqlite", &_register_sqlite);
  lo::modules_add("zlib", &_register_zlib);
}

static const char* main_js = _binary_main_js_start;
static const char* v8flags = "--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init";
static unsigned int _v8flags_from_commandline = 1;
static unsigned int _v8_threads = 2;
static unsigned int _v8_cleanup = 0;
static unsigned int _on_exit = 0;

