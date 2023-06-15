const api = {
  hex_encode: {
    parameters: ['buffer', 'u32', 'buffer', 'u32'],
    pointers: ['const char*', , 'char*'],
    result: 'u32'
  },
  hex_decode: {
    parameters: ['buffer', 'u32', 'buffer', 'u32'],
    pointers: ['char*', , 'const char*'],
    result: 'u32'
  }
}

const preamble = `
const int8_t unhex_table[256] =
  { -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
     0,  1,  2,  3,  4,  5,  6,  7,  8,  9, -1, -1, -1, -1, -1, -1,
    -1, 10, 11, 12, 13, 14, 15, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, 10, 11, 12, 13, 14, 15, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1
  };

inline unsigned unhex(uint8_t x) {
  return unhex_table[x];
}

size_t hex_encode (const char* src, size_t slen, char* dst, size_t dlen) {
  dlen = slen * 2;
  for (uint32_t i = 0, k = 0; k < dlen; i += 1, k += 2) {
    static const char hex[] = "0123456789abcdef";
    uint8_t val = (uint8_t)(src[i]);
    dst[k + 0] = hex[val >> 4];
    dst[k + 1] = hex[val & 15];
  }
  return dlen;
}

size_t hex_decode(char* buf,
                         size_t len,
                         const char* src,
                         const size_t srcLen) {
  size_t i;
  for (i = 0; i < len && i * 2 + 1 < srcLen; ++i) {
    unsigned a = unhex(src[i * 2 + 0]);
    unsigned b = unhex(src[i * 2 + 1]);
    if (!~a || !~b)
      return i;
    buf[i] = (a << 4) | b;
  }

  return i;
}

`
const name = 'encode'

export { name, api, preamble }
