.global __binary_main_js_start
__binary_main_js_start:
        .incbin "main.js"
        .global __binary_main_js_end
__binary_main_js_end:
.global __binary_lib_bench_js_start
__binary_lib_bench_js_start:
        .incbin "lib/bench.js"
        .global __binary_lib_bench_js_end
__binary_lib_bench_js_end:
.global __binary_lib_gen_js_start
__binary_lib_gen_js_start:
        .incbin "lib/gen.js"
        .global __binary_lib_gen_js_end
__binary_lib_gen_js_end:
.global __binary_lib_fs_js_start
__binary_lib_fs_js_start:
        .incbin "lib/fs.js"
        .global __binary_lib_fs_js_end
__binary_lib_fs_js_end:
.global __binary_lib_untar_js_start
__binary_lib_untar_js_start:
        .incbin "lib/untar.js"
        .global __binary_lib_untar_js_end
__binary_lib_untar_js_end:
.global __binary_lib_proc_js_start
__binary_lib_proc_js_start:
        .incbin "lib/proc.js"
        .global __binary_lib_proc_js_end
__binary_lib_proc_js_end:
.global __binary_lib_path_js_start
__binary_lib_path_js_start:
        .incbin "lib/path.js"
        .global __binary_lib_path_js_end
__binary_lib_path_js_end:
.global __binary_lib_curl_js_start
__binary_lib_curl_js_start:
        .incbin "lib/curl.js"
        .global __binary_lib_curl_js_end
__binary_lib_curl_js_end:
.global __binary_lib_inflate_js_start
__binary_lib_inflate_js_start:
        .incbin "lib/inflate.js"
        .global __binary_lib_inflate_js_end
__binary_lib_inflate_js_end:
.global __binary_lib_build_js_start
__binary_lib_build_js_start:
        .incbin "lib/build.js"
        .global __binary_lib_build_js_end
__binary_lib_build_js_end:
.global __binary_lib_asm_js_start
__binary_lib_asm_js_start:
        .incbin "lib/asm.js"
        .global __binary_lib_asm_js_end
__binary_lib_asm_js_end:
.global __binary_lib_ffi_js_start
__binary_lib_ffi_js_start:
        .incbin "lib/ffi.js"
        .global __binary_lib_ffi_js_end
__binary_lib_ffi_js_end:
.global __binary_lib_binary_js_start
__binary_lib_binary_js_start:
        .incbin "lib/binary.js"
        .global __binary_lib_binary_js_end
__binary_lib_binary_js_end:
.global __binary_main_cc_start
__binary_main_cc_start:
        .incbin "main.cc"
        .global __binary_main_cc_end
__binary_main_cc_end:
.global __binary_lo_cc_start
__binary_lo_cc_start:
        .incbin "lo.cc"
        .global __binary_lo_cc_end
__binary_lo_cc_end:
.global __binary_lo_h_start
__binary_lo_h_start:
        .incbin "lo.h"
        .global __binary_lo_h_end
__binary_lo_h_end:
.global __binary_lib_core_api_js_start
__binary_lib_core_api_js_start:
        .incbin "lib/core/api.js"
        .global __binary_lib_core_api_js_end
__binary_lib_core_api_js_end:
.global __binary_lib_curl_api_js_start
__binary_lib_curl_api_js_start:
        .incbin "lib/curl/api.js"
        .global __binary_lib_curl_api_js_end
__binary_lib_curl_api_js_end:
.global __binary_lib_encode_api_js_start
__binary_lib_encode_api_js_start:
        .incbin "lib/encode/api.js"
        .global __binary_lib_encode_api_js_end
__binary_lib_encode_api_js_end:
.global __binary_lib_epoll_api_js_start
__binary_lib_epoll_api_js_start:
        .incbin "lib/epoll/api.js"
        .global __binary_lib_epoll_api_js_end
__binary_lib_epoll_api_js_end:
.global __binary_lib_inflate_api_js_start
__binary_lib_inflate_api_js_start:
        .incbin "lib/inflate/api.js"
        .global __binary_lib_inflate_api_js_end
__binary_lib_inflate_api_js_end:
.global __binary_lib_libffi_api_js_start
__binary_lib_libffi_api_js_start:
        .incbin "lib/libffi/api.js"
        .global __binary_lib_libffi_api_js_end
__binary_lib_libffi_api_js_end:
.global __binary_lib_libssl_api_js_start
__binary_lib_libssl_api_js_start:
        .incbin "lib/libssl/api.js"
        .global __binary_lib_libssl_api_js_end
__binary_lib_libssl_api_js_end:
.global __binary_lib_lz4_api_js_start
__binary_lib_lz4_api_js_start:
        .incbin "lib/lz4/api.js"
        .global __binary_lib_lz4_api_js_end
__binary_lib_lz4_api_js_end:
.global __binary_lib_mbedtls_api_js_start
__binary_lib_mbedtls_api_js_start:
        .incbin "lib/mbedtls/api.js"
        .global __binary_lib_mbedtls_api_js_end
__binary_lib_mbedtls_api_js_end:
.global __binary_lib_net_api_js_start
__binary_lib_net_api_js_start:
        .incbin "lib/net/api.js"
        .global __binary_lib_net_api_js_end
__binary_lib_net_api_js_end:
.global __binary_lib_pico_api_js_start
__binary_lib_pico_api_js_start:
        .incbin "lib/pico/api.js"
        .global __binary_lib_pico_api_js_end
__binary_lib_pico_api_js_end:
.global __binary_lib_pthread_api_js_start
__binary_lib_pthread_api_js_start:
        .incbin "lib/pthread/api.js"
        .global __binary_lib_pthread_api_js_end
__binary_lib_pthread_api_js_end:
.global __binary_lib_seccomp_api_js_start
__binary_lib_seccomp_api_js_start:
        .incbin "lib/seccomp/api.js"
        .global __binary_lib_seccomp_api_js_end
__binary_lib_seccomp_api_js_end:
.global __binary_lib_sqlite_api_js_start
__binary_lib_sqlite_api_js_start:
        .incbin "lib/sqlite/api.js"
        .global __binary_lib_sqlite_api_js_end
__binary_lib_sqlite_api_js_end:
.global __binary_lib_system_api_js_start
__binary_lib_system_api_js_start:
        .incbin "lib/system/api.js"
        .global __binary_lib_system_api_js_end
__binary_lib_system_api_js_end:
.global __binary_lib_tcc_api_js_start
__binary_lib_tcc_api_js_start:
        .incbin "lib/tcc/api.js"
        .global __binary_lib_tcc_api_js_end
__binary_lib_tcc_api_js_end:
.global __binary_lib_wireguard_api_js_start
__binary_lib_wireguard_api_js_start:
        .incbin "lib/wireguard/api.js"
        .global __binary_lib_wireguard_api_js_end
__binary_lib_wireguard_api_js_end:
.global __binary_lib_zlib_api_js_start
__binary_lib_zlib_api_js_start:
        .incbin "lib/zlib/api.js"
        .global __binary_lib_zlib_api_js_end
__binary_lib_zlib_api_js_end:
.global __binary_lib_duckdb_api_js_start
__binary_lib_duckdb_api_js_start:
        .incbin "lib/duckdb/api.js"
        .global __binary_lib_duckdb_api_js_end
__binary_lib_duckdb_api_js_end:
