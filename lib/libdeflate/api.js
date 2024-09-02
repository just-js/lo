const api = {
  alloc_compressor: {
    parameters: ['i32'],
    result: 'pointer',
    name: 'libdeflate_alloc_compressor'
  },
  deflate_compress: {
    parameters: ['pointer', 'pointer', 'u32', 'pointer', 'u32'],
    pointers: ['struct libdeflate_compressor *'],
    result: 'u32',
    name: 'libdeflate_deflate_compress'
  },
  deflate_zlib_compress: {
    parameters: ['pointer', 'pointer', 'u32', 'pointer', 'u32'],
    pointers: ['struct libdeflate_compressor *'],
    result: 'u32',
    name: 'libdeflate_zlib_compress'
  },
  deflate_gzip_compress: {
    parameters: ['pointer', 'pointer', 'u32', 'pointer', 'u32'],
    pointers: ['struct libdeflate_compressor *'],
    result: 'u32',
    name: 'libdeflate_gzip_compress'
  },
  free_compressor: {
    parameters: ['pointer'],
    pointers: ['struct libdeflate_compressor *'],
    result: 'void',
    name: 'libdeflate_free_compressor'
  },
  alloc_decompressor: {
    parameters: [],
    result: 'pointer',
    name: 'libdeflate_alloc_decompressor'
  },
  deflate_decompress: {
    parameters: ['pointer', 'pointer', 'u32', 'pointer', 'u32', 'buffer'],
    pointers: ['struct libdeflate_decompressor *', , , , , 'size_t*'],
    result: 'u32',
    name: 'libdeflate_deflate_decompress'
  },
  deflate_zlib_decompress: {
    parameters: ['pointer', 'pointer', 'u32', 'pointer', 'u32', 'buffer'],
    pointers: ['struct libdeflate_decompressor *', , , , , 'size_t*'],
    result: 'u32',
    name: 'libdeflate_zlib_decompress'
  },
  deflate_gzip_decompress: {
    parameters: ['pointer', 'pointer', 'u32', 'pointer', 'u32', 'buffer'],
    pointers: ['struct libdeflate_decompressor *', , , , , 'size_t*'],
    result: 'u32',
    name: 'libdeflate_gzip_decompress'
  },
  free_decompressor: {
    parameters: ['pointer'],
    pointers: ['struct libdeflate_decompressor *'],
    result: 'void',
    name: 'libdeflate_free_decompressor'
  },
}

const name = 'libdeflate'

const constants = {}
const includes = ['libdeflate.h']
const include_paths = ['./deps/libdeflate']
const obj = ['deps/libdeflate/build/libdeflate.a']

export { name, api, constants, includes, include_paths, obj }
