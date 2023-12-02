#pragma once
// [do not edit,<auto-generated />]
// This file has been automatically generated, please do not change unless you disable auto-generation in the Makefile

#include "lo.h"

#include "builtins.h"
static unsigned int main_js_len = _binary_main_js_len;

extern "C" {
  extern void* _register_core();
  extern void* _register_inflate();
  extern void* _register_curl();
}

void register_builtins() {
  lo::builtins_add("main.js", _binary_main_js_start, _binary_main_js_len);
  lo::builtins_add("lib/bench.js", _binary_lib_bench_js_start, _binary_lib_bench_js_len);
  lo::builtins_add("lib/gen.js", _binary_lib_gen_js_start, _binary_lib_gen_js_len);
  lo::builtins_add("lib/fs.js", _binary_lib_fs_js_start, _binary_lib_fs_js_len);
  lo::builtins_add("lib/untar.js", _binary_lib_untar_js_start, _binary_lib_untar_js_len);
  lo::builtins_add("lib/proc.js", _binary_lib_proc_js_start, _binary_lib_proc_js_len);
  lo::builtins_add("lib/path.js", _binary_lib_path_js_start, _binary_lib_path_js_len);
  lo::builtins_add("lib/inflate.js", _binary_lib_inflate_js_start, _binary_lib_inflate_js_len);
  lo::builtins_add("lib/curl.js", _binary_lib_curl_js_start, _binary_lib_curl_js_len);
  lo::builtins_add("lib/build.js", _binary_lib_build_js_start, _binary_lib_build_js_len);
  lo::builtins_add("lib/asm.js", _binary_lib_asm_js_start, _binary_lib_asm_js_len);
  lo::builtins_add("lib/ffi.js", _binary_lib_ffi_js_start, _binary_lib_ffi_js_len);
  lo::builtins_add("lib/binary.js", _binary_lib_binary_js_start, _binary_lib_binary_js_len);
  lo::builtins_add("lib/tcc.js", _binary_lib_tcc_js_start, _binary_lib_tcc_js_len);
  lo::builtins_add("lib/zlib.js", _binary_lib_zlib_js_start, _binary_lib_zlib_js_len);
  lo::builtins_add("main.cc", _binary_main_cc_start, _binary_main_cc_len);
  lo::builtins_add("lo.cc", _binary_lo_cc_start, _binary_lo_cc_len);
  lo::builtins_add("lo.h", _binary_lo_h_start, _binary_lo_h_len);
  lo::builtins_add("lib/core/api.js", _binary_lib_core_api_js_start, _binary_lib_core_api_js_len);
  lo::builtins_add("lib/curl/api.js", _binary_lib_curl_api_js_start, _binary_lib_curl_api_js_len);
  lo::builtins_add("lib/encode/api.js", _binary_lib_encode_api_js_start, _binary_lib_encode_api_js_len);
  lo::builtins_add("lib/epoll/api.js", _binary_lib_epoll_api_js_start, _binary_lib_epoll_api_js_len);
  lo::builtins_add("lib/inflate/api.js", _binary_lib_inflate_api_js_start, _binary_lib_inflate_api_js_len);
  lo::builtins_add("lib/libffi/api.js", _binary_lib_libffi_api_js_start, _binary_lib_libffi_api_js_len);
  lo::builtins_add("lib/libssl/api.js", _binary_lib_libssl_api_js_start, _binary_lib_libssl_api_js_len);
  lo::builtins_add("lib/lz4/api.js", _binary_lib_lz4_api_js_start, _binary_lib_lz4_api_js_len);
  lo::builtins_add("lib/inflate/em_inflate.c", _binary_lib_inflate_em_inflate_c_start, _binary_lib_inflate_em_inflate_c_len);
  lo::builtins_add("lib/inflate/em_inflate.h", _binary_lib_inflate_em_inflate_h_start, _binary_lib_inflate_em_inflate_h_len);
  lo::builtins_add("lib/mbedtls/api.js", _binary_lib_mbedtls_api_js_start, _binary_lib_mbedtls_api_js_len);
  lo::builtins_add("lib/net/api.js", _binary_lib_net_api_js_start, _binary_lib_net_api_js_len);
  lo::builtins_add("lib/pico/api.js", _binary_lib_pico_api_js_start, _binary_lib_pico_api_js_len);
  lo::builtins_add("lib/pthread/api.js", _binary_lib_pthread_api_js_start, _binary_lib_pthread_api_js_len);
  lo::builtins_add("lib/seccomp/api.js", _binary_lib_seccomp_api_js_start, _binary_lib_seccomp_api_js_len);
  lo::builtins_add("lib/sqlite/api.js", _binary_lib_sqlite_api_js_start, _binary_lib_sqlite_api_js_len);
  lo::builtins_add("lib/system/api.js", _binary_lib_system_api_js_start, _binary_lib_system_api_js_len);
  lo::builtins_add("lib/tcc/api.js", _binary_lib_tcc_api_js_start, _binary_lib_tcc_api_js_len);
  lo::builtins_add("lib/wireguard/api.js", _binary_lib_wireguard_api_js_start, _binary_lib_wireguard_api_js_len);
  lo::builtins_add("lib/zlib/api.js", _binary_lib_zlib_api_js_start, _binary_lib_zlib_api_js_len);
  lo::builtins_add("lib/duckdb/api.js", _binary_lib_duckdb_api_js_start, _binary_lib_duckdb_api_js_len);
  lo::modules_add("core", &_register_core);
  lo::modules_add("inflate", &_register_inflate);
  lo::modules_add("curl", &_register_curl);
}

static const char* main_js = _binary_main_js_start;
static const char* v8flags = "--stack-trace-limit=10 --use-strict --turbo-fast-api-calls --no-freeze-flags-after-init";
static unsigned int _v8flags_from_commandline = 1;
static unsigned int _v8_threads = 2;
static unsigned int _v8_cleanup = 0;
static unsigned int _on_exit = 0;
