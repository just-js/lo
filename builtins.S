.global __binary_main_js_start
__binary_main_js_start:
        .incbin "main.js"
        .global __binary_main_js_end
__binary_main_js_end:
.global __binary_lib_bench_js_start
__binary_lib_bench_js_start:
        .incbin "lib/bench.js"
        .global __binary_lib_bench_js_end
__binary_lib_bench_js_end:
.global __binary_lib_gen_js_start
__binary_lib_gen_js_start:
        .incbin "lib/gen.js"
        .global __binary_lib_gen_js_end
__binary_lib_gen_js_end:
.global __binary_lib_fs_js_start
__binary_lib_fs_js_start:
        .incbin "lib/fs.js"
        .global __binary_lib_fs_js_end
__binary_lib_fs_js_end:
.global __binary_lib_untar_js_start
__binary_lib_untar_js_start:
        .incbin "lib/untar.js"
        .global __binary_lib_untar_js_end
__binary_lib_untar_js_end:
.global __binary_lib_proc_js_start
__binary_lib_proc_js_start:
        .incbin "lib/proc.js"
        .global __binary_lib_proc_js_end
__binary_lib_proc_js_end:
.global __binary_lib_path_js_start
__binary_lib_path_js_start:
        .incbin "lib/path.js"
        .global __binary_lib_path_js_end
__binary_lib_path_js_end:
.global __binary_lib_inflate_js_start
__binary_lib_inflate_js_start:
        .incbin "lib/inflate.js"
        .global __binary_lib_inflate_js_end
__binary_lib_inflate_js_end:
.global __binary_lib_curl_js_start
__binary_lib_curl_js_start:
        .incbin "lib/curl.js"
        .global __binary_lib_curl_js_end
__binary_lib_curl_js_end:
.global __binary_lib_build_js_start
__binary_lib_build_js_start:
        .incbin "lib/build.js"
        .global __binary_lib_build_js_end
__binary_lib_build_js_end:
