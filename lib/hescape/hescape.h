#ifndef HESCAPE_H
#define HESCAPE_H

#include <sys/types.h>
#include <stdint.h>

/*
adapted from https://github.com/k0kubun/hescape
same MIT License

The MIT License (MIT)

Copyright (c) 2016 Takashi Kokubun

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/*
 * Replace characters according to the following rules.
 * Note that this function can handle only ASCII-compatible string.
 *
 * " => &quot;
 * & => &amp;
 * ' => &#39;
 * < => &lt;
 * > => &gt;
 *
 * @return size of dest. If it's larger than len, dest is required to be freed.
 */

#ifdef __cplusplus
extern "C"
    {
#endif

extern size_t hesc_escape_html(char*rbuf, const char*src, size_t size);

#ifdef __cplusplus
    }
#endif

#endif
