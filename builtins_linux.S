.global _binary_Makefile_start
_binary_Makefile_start:
        .incbin "Makefile"
        .global _binary_Makefile_end
_binary_Makefile_end:
.global _binary_globals_d_ts_start
_binary_globals_d_ts_start:
        .incbin "globals.d.ts"
        .global _binary_globals_d_ts_end
_binary_globals_d_ts_end:
.global _binary_jsconfig_json_start
_binary_jsconfig_json_start:
        .incbin "jsconfig.json"
        .global _binary_jsconfig_json_end
_binary_jsconfig_json_end:
.global _binary_lib_asm_js_start
_binary_lib_asm_js_start:
        .incbin "lib/asm.js"
        .global _binary_lib_asm_js_end
_binary_lib_asm_js_end:
.global _binary_lib_bench_js_start
_binary_lib_bench_js_start:
        .incbin "lib/bench.js"
        .global _binary_lib_bench_js_end
_binary_lib_bench_js_end:
.global _binary_lib_binary_js_start
_binary_lib_binary_js_start:
        .incbin "lib/binary.js"
        .global _binary_lib_binary_js_end
_binary_lib_binary_js_end:
.global _binary_lib_core_api_js_start
_binary_lib_core_api_js_start:
        .incbin "lib/core/api.js"
        .global _binary_lib_core_api_js_end
_binary_lib_core_api_js_end:
.global _binary_lib_ffi_js_start
_binary_lib_ffi_js_start:
        .incbin "lib/ffi.js"
        .global _binary_lib_ffi_js_end
_binary_lib_ffi_js_end:
.global _binary_lib_gen_js_start
_binary_lib_gen_js_start:
        .incbin "lib/gen.js"
        .global _binary_lib_gen_js_end
_binary_lib_gen_js_end:
.global _binary_lib_path_js_start
_binary_lib_path_js_start:
        .incbin "lib/path.js"
        .global _binary_lib_path_js_end
_binary_lib_path_js_end:
.global _binary_lib_proc_js_start
_binary_lib_proc_js_start:
        .incbin "lib/proc.js"
        .global _binary_lib_proc_js_end
_binary_lib_proc_js_end:
.global _binary_lib_pthreads_api_js_start
_binary_lib_pthreads_api_js_start:
        .incbin "lib/pthreads/api.js"
        .global _binary_lib_pthreads_api_js_end
_binary_lib_pthreads_api_js_end:
.global _binary_lib_repl_js_start
_binary_lib_repl_js_start:
        .incbin "lib/repl.js"
        .global _binary_lib_repl_js_end
_binary_lib_repl_js_end:
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
.global _binary_main_cc_start
_binary_main_cc_start:
        .incbin "main.cc"
        .global _binary_main_cc_end
_binary_main_cc_end:
.global _binary_main_js_start
_binary_main_js_start:
        .incbin "main.js"
        .global _binary_main_js_end
_binary_main_js_end:
