.global __binary_main_js_start
__binary_main_js_start:
        .incbin "main.js"
        .global __binary_main_js_end
__binary_main_js_end:
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
.global __binary_lib_gen_js_start
__binary_lib_gen_js_start:
        .incbin "lib/gen.js"
        .global __binary_lib_gen_js_end
__binary_lib_gen_js_end:
.global __binary_lib_path_js_start
__binary_lib_path_js_start:
        .incbin "lib/path.js"
        .global __binary_lib_path_js_end
__binary_lib_path_js_end:
.global __binary_lib_proc_js_start
__binary_lib_proc_js_start:
        .incbin "lib/proc.js"
        .global __binary_lib_proc_js_end
__binary_lib_proc_js_end:
.global __binary_Makefile_start
__binary_Makefile_start:
        .incbin "Makefile"
        .global __binary_Makefile_end
__binary_Makefile_end:
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
.global __binary_globals_d_ts_start
__binary_globals_d_ts_start:
        .incbin "globals.d.ts"
        .global __binary_globals_d_ts_end
__binary_globals_d_ts_end:
.global __binary_jsconfig_json_start
__binary_jsconfig_json_start:
        .incbin "jsconfig.json"
        .global __binary_jsconfig_json_end
__binary_jsconfig_json_end:
.global __binary_lib_core_api_js_start
__binary_lib_core_api_js_start:
        .incbin "lib/core/api.js"
        .global __binary_lib_core_api_js_end
__binary_lib_core_api_js_end:

