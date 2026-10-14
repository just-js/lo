/*
 * Strict HTTP/1.1 chunked transfer coding decoder (RFC 9112 7.1). See
 * decoder.h. Based on phr_decode_chunked from picohttpparser (MIT
 * license, Copyright (c) 2009-2014 Kazuho Oku, Tokuhiro Matsuno, Daisuke
 * Murase, Shigeo Mitsunari).
 */
#include <string.h>
#include "decoder.h"

enum {
    S_SIZE,        /* chunk-size digits */
    S_EXT,         /* after the digits: chunk-ext, up to CR (sub: E_*) */
    S_SIZE_LF,     /* LF ending the chunk-size line */
    S_DATA,        /* chunk-data */
    S_DATA_CR,     /* CRLF after chunk-data */
    S_DATA_LF,
    S_TRAILER,     /* trailer section (sub: T_*) */
    S_TRAILER_LF,  /* LF ending a trailer field line */
    S_END_LF       /* LF ending the last (empty) line */
};

/* chunk-ext grammar: *( BWS ";" BWS name [ BWS "=" BWS value ] ) */
enum {
    E_START,       /* right after chunk-size: BWS, ';' or CR */
    E_BWS_SEMI,    /* BWS before ';' */
    E_BWS_NAME,    /* BWS before an extension name */
    E_NAME,
    E_AFTER_NAME,  /* BWS after a name: ';' or '=' must follow */
    E_BWS_VALUE,
    E_VALUE,       /* token value */
    E_QUOTED,      /* quoted-string value */
    E_QUOTED_ESC,
    E_AFTER_QUOTED
};

/* trailer section: *( field-line CRLF ) CRLF */
enum {
    T_LINE_START,  /* CR (end of trailers) or a field name */
    T_NAME,
    T_VALUE
};

/* RFC 9110 5.6.2 tchar */
static const uint8_t tchar[256] = {
    ['!'] = 1, ['#'] = 1, ['$'] = 1, ['%'] = 1, ['&'] = 1, ['\''] = 1,
    ['*'] = 1, ['+'] = 1, ['-'] = 1, ['.'] = 1, ['^'] = 1, ['_'] = 1,
    ['`'] = 1, ['|'] = 1, ['~'] = 1,
    ['0'] = 1, ['1'] = 1, ['2'] = 1, ['3'] = 1, ['4'] = 1, ['5'] = 1,
    ['6'] = 1, ['7'] = 1, ['8'] = 1, ['9'] = 1,
    ['A'] = 1, ['B'] = 1, ['C'] = 1, ['D'] = 1, ['E'] = 1, ['F'] = 1,
    ['G'] = 1, ['H'] = 1, ['I'] = 1, ['J'] = 1, ['K'] = 1, ['L'] = 1,
    ['M'] = 1, ['N'] = 1, ['O'] = 1, ['P'] = 1, ['Q'] = 1, ['R'] = 1,
    ['S'] = 1, ['T'] = 1, ['U'] = 1, ['V'] = 1, ['W'] = 1, ['X'] = 1,
    ['Y'] = 1, ['Z'] = 1,
    ['a'] = 1, ['b'] = 1, ['c'] = 1, ['d'] = 1, ['e'] = 1, ['f'] = 1,
    ['g'] = 1, ['h'] = 1, ['i'] = 1, ['j'] = 1, ['k'] = 1, ['l'] = 1,
    ['m'] = 1, ['n'] = 1, ['o'] = 1, ['p'] = 1, ['q'] = 1, ['r'] = 1,
    ['s'] = 1, ['t'] = 1, ['u'] = 1, ['v'] = 1, ['w'] = 1, ['x'] = 1,
    ['y'] = 1, ['z'] = 1
};

static int decode_hex(unsigned char c)
{
    if (c >= '0' && c <= '9')
        return c - '0';
    if (c >= 'A' && c <= 'F')
        return c - 'A' + 10;
    if (c >= 'a' && c <= 'f')
        return c - 'a' + 10;
    return -1;
}

/* qdtext (RFC 9110 5.6.4): HTAB, SP, %x21, %x23-5B, %x5D-7E, obs-text */
static int is_qdtext(unsigned char c)
{
    return c == '\t' || c == ' ' || c == 0x21 || (c >= 0x23 && c <= 0x5b) ||
        (c >= 0x5d && c <= 0x7e) || c >= 0x80;
}

/* quoted-pair second byte: HTAB, SP, VCHAR, obs-text */
static int is_quoted_pair(unsigned char c)
{
    return c == '\t' || c == ' ' || (c >= 0x21 && c <= 0x7e) || c >= 0x80;
}

/* field-value byte (RFC 9110 5.5): no CTLs except HTAB */
static int is_field_vchar(unsigned char c)
{
    return c == '\t' || (c >= 0x20 && c != 0x7f);
}

/* one chunk-ext byte; returns 1 when it was the line's CR, 0 to go on,
 * -1 on a syntax error */
static int ext_byte(struct chunked_decoder *d, unsigned char c)
{
    int ws = c == ' ' || c == '\t';
    switch (d->sub) {
    case E_START:
        if (c == '\r') return 1;
        if (ws) { d->sub = E_BWS_SEMI; return 0; }
        if (c == ';') { d->sub = E_BWS_NAME; return 0; }
        return -1;
    case E_BWS_SEMI:
        if (ws) return 0;
        if (c == ';') { d->sub = E_BWS_NAME; return 0; }
        return -1;
    case E_BWS_NAME:
        if (ws) return 0;
        if (tchar[c]) { d->sub = E_NAME; return 0; }
        return -1;
    case E_NAME:
        if (tchar[c]) return 0;
        if (c == '\r') return 1;
        if (ws) { d->sub = E_AFTER_NAME; return 0; }
        if (c == ';') { d->sub = E_BWS_NAME; return 0; }
        if (c == '=') { d->sub = E_BWS_VALUE; return 0; }
        return -1;
    case E_AFTER_NAME:
        if (ws) return 0;
        if (c == ';') { d->sub = E_BWS_NAME; return 0; }
        if (c == '=') { d->sub = E_BWS_VALUE; return 0; }
        return -1;
    case E_BWS_VALUE:
        if (ws) return 0;
        if (tchar[c]) { d->sub = E_VALUE; return 0; }
        if (c == '"') { d->sub = E_QUOTED; return 0; }
        return -1;
    case E_VALUE:
        if (tchar[c]) return 0;
        if (c == '\r') return 1;
        if (ws) { d->sub = E_BWS_SEMI; return 0; }
        if (c == ';') { d->sub = E_BWS_NAME; return 0; }
        return -1;
    case E_QUOTED:
        if (c == '"') { d->sub = E_AFTER_QUOTED; return 0; }
        if (c == '\\') { d->sub = E_QUOTED_ESC; return 0; }
        return is_qdtext(c) ? 0 : -1;
    case E_QUOTED_ESC:
        if (!is_quoted_pair(c)) return -1;
        d->sub = E_QUOTED;
        return 0;
    case E_AFTER_QUOTED:
        if (c == '\r') return 1;
        if (ws) { d->sub = E_BWS_SEMI; return 0; }
        if (c == ';') { d->sub = E_BWS_NAME; return 0; }
        return -1;
    }
    return -1;
}

ssize_t chunked_decode(struct chunked_decoder *d, char *buf, size_t *_bufsz)
{
    size_t dst = 0, src = 0, bufsz = *_bufsz;
    ssize_t ret = -2; /* incomplete */

    d->total_read += bufsz;

    while (src < bufsz) {
        unsigned char c = (unsigned char)buf[src];
        switch (d->state) {
        case S_SIZE: {
            int v = decode_hex(c);
            if (v == -1) {
                if (d->hex_count == 0)
                    goto Error;
                d->state = S_EXT;
                d->sub = E_START;
                d->ext_len = 0;
                continue; /* this byte starts the extension part */
            }
            if (d->hex_count == sizeof(uint64_t) * 2)
                goto Error;
            d->bytes_left_in_chunk = d->bytes_left_in_chunk * 16 + v;
            ++d->hex_count;
            ++src;
            break;
        }
        case S_EXT: {
            int r = ext_byte(d, c);
            if (r < 0 || ++d->ext_len > CHUNKED_MAX_EXT)
                goto Error;
            ++src;
            if (r == 1)
                d->state = S_SIZE_LF;
            break;
        }
        case S_SIZE_LF:
            if (c != '\n')
                goto Error;
            ++src;
            d->hex_count = 0;
            if (d->bytes_left_in_chunk == 0) {
                d->state = S_TRAILER;
                d->sub = T_LINE_START;
                d->trailer_len = 0;
            } else {
                d->state = S_DATA;
            }
            break;
        case S_DATA: {
            size_t avail = bufsz - src;
            if (avail < d->bytes_left_in_chunk) {
                if (dst != src)
                    memmove(buf + dst, buf + src, avail);
                src += avail;
                dst += avail;
                d->bytes_left_in_chunk -= avail;
                goto Exit;
            }
            if (dst != src)
                memmove(buf + dst, buf + src, d->bytes_left_in_chunk);
            src += d->bytes_left_in_chunk;
            dst += d->bytes_left_in_chunk;
            d->bytes_left_in_chunk = 0;
            d->state = S_DATA_CR;
            break;
        }
        case S_DATA_CR:
            if (c != '\r')
                goto Error;
            ++src;
            d->state = S_DATA_LF;
            break;
        case S_DATA_LF:
            if (c != '\n')
                goto Error;
            ++src;
            d->state = S_SIZE;
            break;
        case S_TRAILER:
            if (++d->trailer_len > CHUNKED_MAX_TRAILERS)
                goto Error;
            if (d->sub == T_LINE_START) {
                if (c == '\r') {
                    d->state = S_END_LF;
                } else if (tchar[c]) {
                    d->sub = T_NAME;
                } else {
                    goto Error; /* bare LF, obs-fold, bad name */
                }
            } else if (d->sub == T_NAME) {
                if (c == ':')
                    d->sub = T_VALUE;
                else if (!tchar[c])
                    goto Error;
            } else {
                if (c == '\r')
                    d->state = S_TRAILER_LF;
                else if (!is_field_vchar(c))
                    goto Error;
            }
            ++src;
            break;
        case S_TRAILER_LF:
            if (c != '\n')
                goto Error;
            ++src;
            d->state = S_TRAILER;
            d->sub = T_LINE_START;
            break;
        case S_END_LF:
            if (c != '\n')
                goto Error;
            ++src;
            ret = bufsz - src;
            goto Exit;
        default:
            goto Error;
        }
    }

Exit:
    if (dst != src)
        memmove(buf + dst, buf + src, bufsz - src);
    *_bufsz = dst;
    /* as picohttpparser: if incomplete but the overhead of the chunked
     * encoding is >= 100KB and > 80%, signal an error */
    if (ret == -2) {
        d->total_overhead += bufsz - dst;
        if (d->total_overhead >= 100 * 1024 && d->total_read - d->total_overhead < d->total_read / 4)
            ret = -1;
    }
    return ret;

Error:
    *_bufsz = dst;
    return -1;
}
