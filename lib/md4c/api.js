const api = {
  parse: {
    parameters: ['string', 'u32', 'pointer', 'pointer'],
    pointers: ['const MD_CHAR*',, 'const MD_PARSER*'],
    result: 'i32',
    name: 'md_parse'
  },
  html: {
    parameters: ['string', 'u32', 'pointer', 'pointer', 'u32', 'u32'],
    pointers: ['const MD_CHAR*', , 'process_output'],
    result: 'i32',
    name: 'md_html'
  },
  to_html: {
    parameters: ['string', 'u32', 'pointer'],
    pointers: ['const MD_CHAR*', , 'HtmlBuffer*'],
    result: 'i32',
  }
}

// https://bun.com/blog/bun-v1.3.8

const constants = {
  MD_FLAG_COLLAPSEWHITESPACE: 'i32',
  MD_DIALECT_GITHUB: 'i32',
  MD_DIALECT_COMMONMARK: 'i32',

  MD_BLOCK_DOC: 'i32',
  MD_BLOCK_QUOTE: 'i32',
  MD_BLOCK_UL: 'i32',
  MD_BLOCK_OL: 'i32',
  MD_BLOCK_LI: 'i32',
  MD_BLOCK_HR: 'i32',
  MD_BLOCK_H: 'i32',
  MD_BLOCK_CODE: 'i32',
  MD_BLOCK_HTML: 'i32',
  MD_BLOCK_P: 'i32',
  MD_BLOCK_TABLE: 'i32',
  MD_BLOCK_THEAD: 'i32',
  MD_BLOCK_TBODY: 'i32',
  MD_BLOCK_TR: 'i32',
  MD_BLOCK_TH: 'i32',
  MD_BLOCK_TD: 'i32',

  MD_SPAN_EM: 'i32',
  MD_SPAN_STRONG: 'i32',
  MD_SPAN_A: 'i32',
  MD_SPAN_IMG: 'i32',
  MD_SPAN_CODE: 'i32',
  MD_SPAN_DEL: 'i32',
  MD_SPAN_LATEXMATH: 'i32',
  MD_SPAN_LATEXMATH_DISPLAY: 'i32',
  MD_SPAN_WIKILINK: 'i32',
  MD_SPAN_U: 'i32',

  MD_TEXT_NORMAL: 'i32',
  MD_TEXT_NULLCHAR: 'i32',
  MD_TEXT_BR: 'i32',
  MD_TEXT_SOFTBR: 'i32',
  MD_TEXT_ENTITY: 'i32',
  MD_TEXT_CODE: 'i32',
  MD_TEXT_HTML: 'i32',
  MD_TEXT_LATEXMATH: 'i32',

  MD_ALIGN_DEFAULT: 'i32',
  MD_ALIGN_LEFT: 'i32',
  MD_ALIGN_CENTER: 'i32',
  MD_ALIGN_RIGHT: 'i32',

  MD_FLAG_COLLAPSEWHITESPACE: 'i32',
  MD_FLAG_PERMISSIVEATXHEADERS: 'i32',
  MD_FLAG_PERMISSIVEURLAUTOLINKS: 'i32',
  MD_FLAG_PERMISSIVEEMAILAUTOLINKS: 'i32',
  MD_FLAG_NOINDENTEDCODEBLOCKS: 'i32',
  MD_FLAG_NOHTMLBLOCKS: 'i32',
  MD_FLAG_NOHTMLSPANS: 'i32',
  MD_FLAG_TABLES: 'i32',
  MD_FLAG_STRIKETHROUGH: 'i32',
  MD_FLAG_PERMISSIVEWWWAUTOLINKS: 'i32',
  MD_FLAG_TASKLISTS: 'i32',
  MD_FLAG_LATEXMATHSPANS: 'i32',
  MD_FLAG_WIKILINKS: 'i32',
  MD_FLAG_UNDERLINE: 'i32',
  MD_FLAG_HARD_SOFT_BREAKS: 'i32',
  MD_FLAG_PERMISSIVEAUTOLINKS: 'i32',
  MD_FLAG_NOHTML: 'i32',

  MD_HTML_FLAG_DEBUG: 'i32',
  MD_HTML_FLAG_VERBATIM_ENTITIES: 'i32',
  MD_HTML_FLAG_SKIP_UTF8_BOM: 'i32',
  MD_HTML_FLAG_XHTML: 'i32',


}
const includes = ['md4c.h', 'md4c-html.h']
const name = 'md4c'
const libs = []
const obj = ['deps/md4c/build/src/libmd4c.a', 'deps/md4c/build/src/libmd4c-html.a']
const include_paths = ['deps/md4c/src']
const structs = [
  'MD_ATTRIBUTE',
  'MD_BLOCK_UL_DETAIL',
  'MD_BLOCK_OL_DETAIL',
  'MD_BLOCK_LI_DETAIL',
  'MD_BLOCK_H_DETAIL',
  'MD_BLOCK_CODE_DETAIL',
  'MD_BLOCK_TABLE_DETAIL',
  'MD_BLOCK_TD_DETAIL',
  'MD_SPAN_A_DETAIL',
  'MD_SPAN_IMG_DETAIL',
  'MD_SPAN_WIKILINK',
  'MD_PARSER',
]
const preamble = `
typedef void (*process_output)(const MD_CHAR*, MD_SIZE, void*);

typedef struct {
  char* data;
  size_t size;
  size_t capacity;
} HtmlBuffer;

void append_to_buffer (const MD_CHAR* text, MD_SIZE size, void* userdata) {
  HtmlBuffer* buf = (HtmlBuffer*)userdata;
  if (buf->size + size + 1 > buf->capacity) {
    size_t new_capacity = buf->capacity ? buf->capacity * 2 : 1024 * 1024;
    while (new_capacity < buf->size + size + 1) new_capacity *= 2;
    char* new_data = (char*)realloc(buf->data, new_capacity);
    if (!new_data) return;
    buf->data = new_data;
    buf->capacity = new_capacity;
  }
  memcpy(buf->data + buf->size, text, size);
  buf->size += size;
}

int to_html (const MD_CHAR* text, MD_SIZE size, HtmlBuffer* html) {
  memset(html->data, 0, html->size);
  html->size = 0;
  return md_html(text, size, append_to_buffer, html, MD_FLAG_STRIKETHROUGH, 0);
}

`

export { api, includes, name, obj, libs, constants, include_paths, structs, preamble }
