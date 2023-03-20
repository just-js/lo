.global _binary_main_js_start
_binary_main_js_start:
        .incbin "main.js"
        .global _binary_main_js_end
_binary_main_js_end:
.global _binary_lib_ansi_js_start
_binary_lib_ansi_js_start:
        .incbin "lib/ansi.js"
        .global _binary_lib_ansi_js_end
_binary_lib_ansi_js_end:
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
.global _binary_lib_packet_js_start
_binary_lib_packet_js_start:
        .incbin "lib/packet.js"
        .global _binary_lib_packet_js_end
_binary_lib_packet_js_end:
.global _binary_lib_path_js_start
_binary_lib_path_js_start:
        .incbin "lib/path.js"
        .global _binary_lib_path_js_end
_binary_lib_path_js_end:
.global _binary_lib_stringify_js_start
_binary_lib_stringify_js_start:
        .incbin "lib/stringify.js"
        .global _binary_lib_stringify_js_end
_binary_lib_stringify_js_end:

