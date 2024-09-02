const api = {
  deflate: {
    parameters: ['buffer', 'u32', 'buffer', 'u32', 'u32'],
    pointers: ['uint8_t*', ,'uint8_t*'],
    result: 'u32',
    name: 'zlib_deflate'
  },
  inflate: {
    parameters: ['buffer', 'u32', 'buffer', 'u32'],
    pointers: ['uint8_t*', ,'uint8_t*'],
    result: 'u32',
    name: 'zlib_inflate'
  }
}
const includes = ['zlib.h', 'stdint.h', 'stdlib.h']
const preamble = `
#define Z_DEFAULT_MEMLEVEL 8

uint32_t zlib_deflate (uint8_t* src, uint32_t ssize, uint8_t* dest, uint32_t dsize, unsigned int compression = Z_DEFAULT_COMPRESSION) {
  z_stream* stream = (z_stream*)calloc(1, sizeof(z_stream));
//  unsigned int compression = Z_DEFAULT_COMPRESSION;
  int windowbits = 31;
  deflateInit2(stream, compression, Z_DEFLATED, windowbits, Z_DEFAULT_MEMLEVEL, Z_DEFAULT_STRATEGY);
  stream->next_in = (Bytef*)src;
  stream->avail_in = ssize;
  stream->next_out = (Bytef*)dest;
  stream->avail_out = dsize;
  uint32_t avail_out = stream->avail_out;
  uint32_t flush = Z_FINISH;
  deflate(stream, flush);
  uint32_t written = avail_out - stream->avail_out;
  deflateEnd(stream);
  free(stream);
  return written;
}

// todo: this api is kinda nasty - fix it
uint32_t zlib_inflate (uint8_t* src, uint32_t ssize, uint8_t* dest, uint32_t dsize) {
  z_stream* stream = (z_stream*)calloc(1, sizeof(z_stream));
  int windowbits = 31;
  inflateInit2(stream, windowbits);
  stream->next_in = (Bytef*)src;
  stream->avail_in = ssize;
  stream->next_out = (Bytef*)dest;
  stream->avail_out = dsize;
  uint32_t avail_out = stream->avail_out;
  uint32_t flush = Z_FINISH;
  //fprintf(stderr, "before next_in %lu avail_in %u next_out %lu avail_out %u\\n", (uint64_t)stream->next_in, stream->avail_in, (uint64_t)stream->next_out, stream->avail_out);
  inflate(stream, flush);
  //fprintf(stderr, "after next_in %lu avail_in %u next_out %lu avail_out %u, rc = %i\\n", (uint64_t)stream->next_in, stream->avail_in, (uint64_t)stream->next_out, stream->avail_out, rc);
  uint32_t written = avail_out - stream->avail_out;
  inflateEnd(stream);
  free(stream);
  return written;
}
`
//const libs = ['z']
const name = 'zlib'
const libs = []
const obj = ['deps/zlib/libz.a']

/*
deps/zlib-ng-2.0.6/libz.a: ## build zlib-ng
	mkdir -p deps
	curl -L -o zlib-ng.tar.gz https://github.com/zlib-ng/zlib-ng/archive/refs/tags/2.0.6.tar.gz
	tar -zxvf zlib-ng.tar.gz -C deps/
	rm -f zlib-ng.tar.gz
	cd deps/zlib-ng-2.0.6 && ./configure --zlib-compat && make -j $(NPROCS)

*/

export { api, libs, name, includes, preamble, obj }
