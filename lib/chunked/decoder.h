/*
 * Strict HTTP/1.1 chunked transfer coding decoder (RFC 9112 7.1).
 *
 * Based on phr_decode_chunked from picohttpparser
 * (https://github.com/h2o/picohttpparser, MIT license, Copyright (c)
 * 2009-2014 Kazuho Oku, Tokuhiro Matsuno, Daisuke Murase, Shigeo
 * Mitsunari). Same in-place decoding and return values; stricter grammar:
 *
 * - chunk-size: 1*HEXDIG, at most 16 digits
 * - chunk-ext: *( BWS ";" BWS token [ BWS "=" BWS ( token / quoted-string ) ] ),
 *   at most CHUNKED_MAX_EXT bytes per chunk line. whitespace is only
 *   allowed where BWS is, so "5 \r\n" (whitespace before CRLF) is an error
 * - every line ends in CRLF: a bare CR or LF is an error
 * - trailer section: *( field-line CRLF ) CRLF, where a field-line is
 *   token ":" and a value without CTLs other than HTAB; at most
 *   CHUNKED_MAX_TRAILERS bytes
 */
#ifndef LO_CHUNKED_DECODER_H
#define LO_CHUNKED_DECODER_H

#include <stdint.h>
#include <sys/types.h>

#define CHUNKED_MAX_EXT 4096
#define CHUNKED_MAX_TRAILERS 16384

#ifdef __cplusplus
extern "C" {
#endif

/* zero-fill before the first call for a body */
struct chunked_decoder {
    uint64_t bytes_left_in_chunk;
    uint64_t total_read;
    uint64_t total_overhead;
    uint32_t ext_len;
    uint32_t trailer_len;
    uint8_t state;
    uint8_t sub;
    uint8_t hex_count;
    uint8_t pad[5];
};

/*
 * decodes buf[0..*bufsz) in place, as phr_decode_chunked does: on return
 * *bufsz is the number of decoded body bytes now at the start of buf.
 * returns -2 when more input is needed (call again with the next bytes),
 * -1 on a syntax error, or, when the body is complete, the number of bytes
 * after it, moved to follow the decoded data
 */
ssize_t chunked_decode(struct chunked_decoder *decoder, char *buf, size_t *bufsz);

#ifdef __cplusplus
}
#endif

#endif
