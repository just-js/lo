.global __binary_main_js_start
__binary_main_js_start:
        .incbin "main.js"
        .global __binary_main_js_end
__binary_main_js_end:.global __binary_lib_gen_js_start
__binary_lib_gen_js_start:
        .incbin "lib/gen.js"
        .global __binary_lib_gen_js_end
__binary_lib_gen_js_end:.global __binary_Makefile_start
__binary_Makefile_start:
        .incbin "Makefile"
        .global __binary_Makefile_end
__binary_Makefile_end:.global __binary_binding_core_core_js_start
__binary_binding_core_core_js_start:
        .incbin "binding/core/core.js"
        .global __binary_binding_core_core_js_end
__binary_binding_core_core_js_end:.global __binary_main_cc_start
__binary_main_cc_start:
        .incbin "main.cc"
        .global __binary_main_cc_end
__binary_main_cc_end:.global __binary_lo_cc_start
__binary_lo_cc_start:
        .incbin "lo.cc"
        .global __binary_lo_cc_end
__binary_lo_cc_end:.global __binary_lo_h_start
__binary_lo_h_start:
        .incbin "lo.h"
        .global __binary_lo_h_end
__binary_lo_h_end:
