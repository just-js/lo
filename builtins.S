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
.global _binary_lib_net_js_start
_binary_lib_net_js_start:
        .incbin "lib/net.js"
        .global _binary_lib_net_js_end
_binary_lib_net_js_end:
.global _binary_lib_loop_js_start
_binary_lib_loop_js_start:
        .incbin "lib/loop.js"
        .global _binary_lib_loop_js_end
_binary_lib_loop_js_end:
.global _binary_lib_pico_js_start
_binary_lib_pico_js_start:
        .incbin "lib/pico.js"
        .global _binary_lib_pico_js_end
_binary_lib_pico_js_end:
.global _binary_lib_timer_js_start
_binary_lib_timer_js_start:
        .incbin "lib/timer.js"
        .global _binary_lib_timer_js_end
_binary_lib_timer_js_end:
.global _binary_lib_binary_js_start
_binary_lib_binary_js_start:
        .incbin "lib/binary.js"
        .global _binary_lib_binary_js_end
_binary_lib_binary_js_end:
.global _binary_lib_acorn_js_start
_binary_lib_acorn_js_start:
        .incbin "lib/acorn.js"
        .global _binary_lib_acorn_js_end
_binary_lib_acorn_js_end:
.global _binary_lib_path_js_start
_binary_lib_path_js_start:
        .incbin "lib/path.js"
        .global _binary_lib_path_js_end
_binary_lib_path_js_end:
.global _binary_lib_thread_js_start
_binary_lib_thread_js_start:
        .incbin "lib/thread.js"
        .global _binary_lib_thread_js_end
_binary_lib_thread_js_end:
.global _binary_lib_fs_js_start
_binary_lib_fs_js_start:
        .incbin "lib/fs.js"
        .global _binary_lib_fs_js_end
_binary_lib_fs_js_end:
.global _binary_lib_websocket_js_start
_binary_lib_websocket_js_start:
        .incbin "lib/websocket.js"
        .global _binary_lib_websocket_js_end
_binary_lib_websocket_js_end:

