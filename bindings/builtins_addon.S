.global _binary_lib_ffi_js_start
_binary_lib_ffi_js_start:
        .incbin "lib/ffi.js"
        .global _binary_lib_ffi_js_end
_binary_lib_ffi_js_end:
.global _binary_lib_proc_js_start
_binary_lib_proc_js_start:
        .incbin "lib/proc.js"
        .global _binary_lib_proc_js_end
_binary_lib_proc_js_end:
.global _binary_lib_bench_js_start
_binary_lib_bench_js_start:
        .incbin "lib/bench.js"
        .global _binary_lib_bench_js_end
_binary_lib_bench_js_end:
.global _binary_lib_asm_js_start
_binary_lib_asm_js_start:
        .incbin "lib/asm.js"
        .global _binary_lib_asm_js_end
_binary_lib_asm_js_end:
.global _binary_lib_asm_x64_js_start
_binary_lib_asm_x64_js_start:
        .incbin "lib/asm/x64.js"
        .global _binary_lib_asm_x64_js_end
_binary_lib_asm_x64_js_end:
.global _binary_lib_asm_compiler_js_start
_binary_lib_asm_compiler_js_start:
        .incbin "lib/asm/compiler.js"
        .global _binary_lib_asm_compiler_js_end
_binary_lib_asm_compiler_js_end:
.global _binary_lib_fs_js_start
_binary_lib_fs_js_start:
        .incbin "lib/fs.js"
        .global _binary_lib_fs_js_end
_binary_lib_fs_js_end: