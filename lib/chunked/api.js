// strict HTTP/1.1 chunked transfer coding decoder (RFC 9112 7.1), see
// decoder.h. same calling convention as pico.decode_chunked:
// decode(decoder, buf, size_t *bufsz) -> -2 incomplete, -1 error, or the
// number of bytes after the body
const api = {
  decode: {
    parameters: ['pointer', 'pointer', 'pointer'],
    pointers: ['struct chunked_decoder *', 'char*', 'size_t*'],
    result: 'i32',
    name: 'chunked_decode'
  }
}

const name = 'chunked'
const includes = ['decoder.h']
const obj = ['decoder.o']
const structs = ['chunked_decoder']

export { name, api, includes, obj, structs }
