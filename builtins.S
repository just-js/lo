.global _binary_main_js_start
_binary_main_js_start:
        .incbin "main.js"
        .global _binary_main_js_end
_binary_main_js_end:
.global _binary_snapshot_bin_start
_binary_snapshot_bin_start:
        .incbin "snapshot.bin"
        .global _binary_snapshot_bin_end
_binary_snapshot_bin_end:

