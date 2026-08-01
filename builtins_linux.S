.global _binary_runtime_zero_js_start
_binary_runtime_zero_js_start:
        .incbin "runtime/zero.js"
        .global _binary_runtime_zero_js_end
_binary_runtime_zero_js_end:
.section .note.GNU-stack,"",@progbits