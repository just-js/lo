.global _binary_main_js_start
_binary_main_js_start:
        .incbin "main.js"
        .global _binary_main_js_end
_binary_main_js_end:
.global _binary_lib_curl_js_start
_binary_lib_curl_js_start:
        .incbin "lib/curl.js"
        .global _binary_lib_curl_js_end
_binary_lib_curl_js_end:
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
.global _binary_lib_stringify_js_start
_binary_lib_stringify_js_start:
        .incbin "lib/stringify.js"
        .global _binary_lib_stringify_js_end
_binary_lib_stringify_js_end:
.global _binary_main_cc_start
_binary_main_cc_start:
        .incbin "main.cc"
        .global _binary_main_cc_end
_binary_main_cc_end:
.global _binary_main_h_start
_binary_main_h_start:
        .incbin "main.h"
        .global _binary_main_h_end
_binary_main_h_end:
.global _binary_lo_h_start
_binary_lo_h_start:
        .incbin "lo.h"
        .global _binary_lo_h_end
_binary_lo_h_end:
.global _binary_lo_cc_start
_binary_lo_cc_start:
        .incbin "lo.cc"
        .global _binary_lo_cc_end
_binary_lo_cc_end:
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
.global _binary_runtimes_base_config_js_start
_binary_runtimes_base_config_js_start:
        .incbin "runtimes/base.config.js"
        .global _binary_runtimes_base_config_js_end
_binary_runtimes_base_config_js_end:
.global _binary_runtimes_lo_config_js_start
_binary_runtimes_lo_config_js_start:
        .incbin "runtimes/lo.config.js"
        .global _binary_runtimes_lo_config_js_end
_binary_runtimes_lo_config_js_end:
.global _binary_globals_d_ts_start
_binary_globals_d_ts_start:
        .incbin "globals.d.ts"
        .global _binary_globals_d_ts_end
_binary_globals_d_ts_end:
