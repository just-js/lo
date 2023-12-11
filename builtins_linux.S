.global _binary_main_js_start
_binary_main_js_start:
        .incbin "main.js"
        .global _binary_main_js_end
_binary_main_js_end:
.global _binary_lib_bench_js_start
_binary_lib_bench_js_start:
        .incbin "lib/bench.js"
        .global _binary_lib_bench_js_end
_binary_lib_bench_js_end:
.global _binary_lib_gen_js_start
_binary_lib_gen_js_start:
        .incbin "lib/gen.js"
        .global _binary_lib_gen_js_end
_binary_lib_gen_js_end:
.global _binary_lib_fs_js_start
_binary_lib_fs_js_start:
        .incbin "lib/fs.js"
        .global _binary_lib_fs_js_end
_binary_lib_fs_js_end:
.global _binary_lib_untar_js_start
_binary_lib_untar_js_start:
        .incbin "lib/untar.js"
        .global _binary_lib_untar_js_end
_binary_lib_untar_js_end:
.global _binary_lib_proc_js_start
_binary_lib_proc_js_start:
        .incbin "lib/proc.js"
        .global _binary_lib_proc_js_end
_binary_lib_proc_js_end:
.global _binary_lib_path_js_start
_binary_lib_path_js_start:
        .incbin "lib/path.js"
        .global _binary_lib_path_js_end
_binary_lib_path_js_end:
.global _binary_lib_curl_js_start
_binary_lib_curl_js_start:
        .incbin "lib/curl.js"
        .global _binary_lib_curl_js_end
_binary_lib_curl_js_end:
.global _binary_lib_inflate_js_start
_binary_lib_inflate_js_start:
        .incbin "lib/inflate.js"
        .global _binary_lib_inflate_js_end
_binary_lib_inflate_js_end:
.global _binary_lib_build_js_start
_binary_lib_build_js_start:
        .incbin "lib/build.js"
        .global _binary_lib_build_js_end
_binary_lib_build_js_end:
.global _binary_lib_asm_js_start
_binary_lib_asm_js_start:
        .incbin "lib/asm.js"
        .global _binary_lib_asm_js_end
_binary_lib_asm_js_end:
.global _binary_lib_ffi_js_start
_binary_lib_ffi_js_start:
        .incbin "lib/ffi.js"
        .global _binary_lib_ffi_js_end
_binary_lib_ffi_js_end:
.global _binary_lib_binary_js_start
_binary_lib_binary_js_start:
        .incbin "lib/binary.js"
        .global _binary_lib_binary_js_end
_binary_lib_binary_js_end:
.global _binary_main_cc_start
_binary_main_cc_start:
        .incbin "main.cc"
        .global _binary_main_cc_end
_binary_main_cc_end:
.global _binary_lo_cc_start
_binary_lo_cc_start:
        .incbin "lo.cc"
        .global _binary_lo_cc_end
_binary_lo_cc_end:
.global _binary_lo_h_start
_binary_lo_h_start:
        .incbin "lo.h"
        .global _binary_lo_h_end
_binary_lo_h_end:
.global _binary_lib_core_api_js_start
_binary_lib_core_api_js_start:
        .incbin "lib/core/api.js"
        .global _binary_lib_core_api_js_end
_binary_lib_core_api_js_end:
.global _binary_lib_curl_api_js_start
_binary_lib_curl_api_js_start:
        .incbin "lib/curl/api.js"
        .global _binary_lib_curl_api_js_end
_binary_lib_curl_api_js_end:
.global _binary_lib_duckdb_api_js_start
_binary_lib_duckdb_api_js_start:
        .incbin "lib/duckdb/api.js"
        .global _binary_lib_duckdb_api_js_end
_binary_lib_duckdb_api_js_end:
.global _binary_lib_duckdb_build_js_start
_binary_lib_duckdb_build_js_start:
        .incbin "lib/duckdb/build.js"
        .global _binary_lib_duckdb_build_js_end
_binary_lib_duckdb_build_js_end:
.global _binary_lib_encode_api_js_start
_binary_lib_encode_api_js_start:
        .incbin "lib/encode/api.js"
        .global _binary_lib_encode_api_js_end
_binary_lib_encode_api_js_end:
.global _binary_lib_epoll_api_js_start
_binary_lib_epoll_api_js_start:
        .incbin "lib/epoll/api.js"
        .global _binary_lib_epoll_api_js_end
_binary_lib_epoll_api_js_end:
.global _binary_lib_inflate_api_js_start
_binary_lib_inflate_api_js_start:
        .incbin "lib/inflate/api.js"
        .global _binary_lib_inflate_api_js_end
_binary_lib_inflate_api_js_end:
.global _binary_lib_inflate_build_js_start
_binary_lib_inflate_build_js_start:
        .incbin "lib/inflate/build.js"
        .global _binary_lib_inflate_build_js_end
_binary_lib_inflate_build_js_end:
.global _binary_lib_libffi_api_js_start
_binary_lib_libffi_api_js_start:
        .incbin "lib/libffi/api.js"
        .global _binary_lib_libffi_api_js_end
_binary_lib_libffi_api_js_end:
.global _binary_lib_libssl_api_js_start
_binary_lib_libssl_api_js_start:
        .incbin "lib/libssl/api.js"
        .global _binary_lib_libssl_api_js_end
_binary_lib_libssl_api_js_end:
.global _binary_lib_lz4_api_js_start
_binary_lib_lz4_api_js_start:
        .incbin "lib/lz4/api.js"
        .global _binary_lib_lz4_api_js_end
_binary_lib_lz4_api_js_end:
.global _binary_lib_mbedtls_api_js_start
_binary_lib_mbedtls_api_js_start:
        .incbin "lib/mbedtls/api.js"
        .global _binary_lib_mbedtls_api_js_end
_binary_lib_mbedtls_api_js_end:
.global _binary_lib_mbedtls_build_js_start
_binary_lib_mbedtls_build_js_start:
        .incbin "lib/mbedtls/build.js"
        .global _binary_lib_mbedtls_build_js_end
_binary_lib_mbedtls_build_js_end:
.global _binary_lib_net_api_js_start
_binary_lib_net_api_js_start:
        .incbin "lib/net/api.js"
        .global _binary_lib_net_api_js_end
_binary_lib_net_api_js_end:
.global _binary_lib_pico_api_js_start
_binary_lib_pico_api_js_start:
        .incbin "lib/pico/api.js"
        .global _binary_lib_pico_api_js_end
_binary_lib_pico_api_js_end:
.global _binary_lib_pico_build_js_start
_binary_lib_pico_build_js_start:
        .incbin "lib/pico/build.js"
        .global _binary_lib_pico_build_js_end
_binary_lib_pico_build_js_end:
.global _binary_lib_pthread_api_js_start
_binary_lib_pthread_api_js_start:
        .incbin "lib/pthread/api.js"
        .global _binary_lib_pthread_api_js_end
_binary_lib_pthread_api_js_end:
.global _binary_lib_seccomp_api_js_start
_binary_lib_seccomp_api_js_start:
        .incbin "lib/seccomp/api.js"
        .global _binary_lib_seccomp_api_js_end
_binary_lib_seccomp_api_js_end:
.global _binary_lib_sqlite_api_js_start
_binary_lib_sqlite_api_js_start:
        .incbin "lib/sqlite/api.js"
        .global _binary_lib_sqlite_api_js_end
_binary_lib_sqlite_api_js_end:
.global _binary_lib_system_api_js_start
_binary_lib_system_api_js_start:
        .incbin "lib/system/api.js"
        .global _binary_lib_system_api_js_end
_binary_lib_system_api_js_end:
.global _binary_lib_tcc_api_js_start
_binary_lib_tcc_api_js_start:
        .incbin "lib/tcc/api.js"
        .global _binary_lib_tcc_api_js_end
_binary_lib_tcc_api_js_end:
.global _binary_lib_tcc_build_js_start
_binary_lib_tcc_build_js_start:
        .incbin "lib/tcc/build.js"
        .global _binary_lib_tcc_build_js_end
_binary_lib_tcc_build_js_end:
.global _binary_lib_wireguard_api_js_start
_binary_lib_wireguard_api_js_start:
        .incbin "lib/wireguard/api.js"
        .global _binary_lib_wireguard_api_js_end
_binary_lib_wireguard_api_js_end:
.global _binary_lib_wireguard_build_js_start
_binary_lib_wireguard_build_js_start:
        .incbin "lib/wireguard/build.js"
        .global _binary_lib_wireguard_build_js_end
_binary_lib_wireguard_build_js_end:
.global _binary_lib_zlib_api_js_start
_binary_lib_zlib_api_js_start:
        .incbin "lib/zlib/api.js"
        .global _binary_lib_zlib_api_js_end
_binary_lib_zlib_api_js_end:
