.global _binary_main_js_start
_binary_main_js_start:
        .incbin "main.js"
        .global _binary_main_js_end
_binary_main_js_end:.global _binary_lib_gen_js_start
_binary_lib_gen_js_start:
        .incbin "lib/gen.js"
        .global _binary_lib_gen_js_end
_binary_lib_gen_js_end:.global _binary_Makefile_start
_binary_Makefile_start:
        .incbin "Makefile"
        .global _binary_Makefile_end
_binary_Makefile_end:.global _binary_lib_core_api_js_start
_binary_lib_core_api_js_start:
        .incbin "lib/core/api.js"
        .global _binary_lib_core_api_js_end
_binary_lib_core_api_js_end:.global _binary_main_cc_start
_binary_main_cc_start:
        .incbin "main.cc"
        .global _binary_main_cc_end
_binary_main_cc_end:.global _binary_lo_cc_start
_binary_lo_cc_start:
        .incbin "lo.cc"
        .global _binary_lo_cc_end
_binary_lo_cc_end:.global _binary_lo_h_start
_binary_lo_h_start:
        .incbin "lo.h"
        .global _binary_lo_h_end
_binary_lo_h_end:
