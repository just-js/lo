.global _binary_lib_bench_js_start
_binary_lib_bench_js_start:
        .incbin "lib/bench.js"
        .global _binary_lib_bench_js_end
_binary_lib_bench_js_end:
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
