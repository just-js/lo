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
.global _binary_Makefile_start
_binary_Makefile_start:
        .incbin "Makefile"
        .global _binary_Makefile_end
_binary_Makefile_end:
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
.global _binary_spin_cc_start
_binary_spin_cc_start:
        .incbin "spin.cc"
        .global _binary_spin_cc_end
_binary_spin_cc_end:
.global _binary_spin_h_start
_binary_spin_h_start:
        .incbin "spin.h"
        .global _binary_spin_h_end
_binary_spin_h_end:
.global _binary_bindings_encode_encode_js_start
_binary_bindings_encode_encode_js_start:
        .incbin "bindings/encode/encode.js"
        .global _binary_bindings_encode_encode_js_end
_binary_bindings_encode_encode_js_end:
.global _binary_bindings_epoll_epoll_js_start
_binary_bindings_epoll_epoll_js_start:
        .incbin "bindings/epoll/epoll.js"
        .global _binary_bindings_epoll_epoll_js_end
_binary_bindings_epoll_epoll_js_end:
.global _binary_bindings_fast_fast_js_start
_binary_bindings_fast_fast_js_start:
        .incbin "bindings/fast/fast.js"
        .global _binary_bindings_fast_fast_js_end
_binary_bindings_fast_fast_js_end:
.global _binary_bindings_fs_fs_js_start
_binary_bindings_fs_fs_js_start:
        .incbin "bindings/fs/fs.js"
        .global _binary_bindings_fs_fs_js_end
_binary_bindings_fs_fs_js_end:
.global _binary_bindings_load_load_js_start
_binary_bindings_load_load_js_start:
        .incbin "bindings/load/load.js"
        .global _binary_bindings_load_load_js_end
_binary_bindings_load_load_js_end:
.global _binary_bindings_net_net_js_start
_binary_bindings_net_net_js_start:
        .incbin "bindings/net/net.js"
        .global _binary_bindings_net_net_js_end
_binary_bindings_net_net_js_end:
.global _binary_bindings_pico_pico_js_start
_binary_bindings_pico_pico_js_start:
        .incbin "bindings/pico/pico.js"
        .global _binary_bindings_pico_pico_js_end
_binary_bindings_pico_pico_js_end:
.global _binary_bindings_spin_spin_js_start
_binary_bindings_spin_spin_js_start:
        .incbin "bindings/spin/spin.js"
        .global _binary_bindings_spin_spin_js_end
_binary_bindings_spin_spin_js_end:
.global _binary_bindings_system_system_js_start
_binary_bindings_system_system_js_start:
        .incbin "bindings/system/system.js"
        .global _binary_bindings_system_system_js_end
_binary_bindings_system_system_js_end:
.global _binary_bindings_thread_thread_js_start
_binary_bindings_thread_thread_js_start:
        .incbin "bindings/thread/thread.js"
        .global _binary_bindings_thread_thread_js_end
_binary_bindings_thread_thread_js_end:

