.global _binary_main_js_start
_binary_main_js_start:
        .incbin "main.js"
        .global _binary_main_js_end
_binary_main_js_end:
.global _binary_lib_gen_js_start
_binary_lib_gen_js_start:
        .incbin "lib/gen.js"
        .global _binary_lib_gen_js_end
_binary_lib_gen_js_end:
.global _binary_lib_system_js_start
_binary_lib_system_js_start:
        .incbin "lib/system.js"
        .global _binary_lib_system_js_end
_binary_lib_system_js_end:
.global _binary_lib_fast_js_start
_binary_lib_fast_js_start:
        .incbin "lib/fast.js"
        .global _binary_lib_fast_js_end
_binary_lib_fast_js_end:
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
.global _binary_lib_thread_js_start
_binary_lib_thread_js_start:
        .incbin "lib/thread.js"
        .global _binary_lib_thread_js_end
_binary_lib_thread_js_end:

