// simdjson (https://github.com/simdjson/simdjson, Daniel Lemire et al.),
// single-header amalgamation, built by build.js. simdjson.h stays out of the
// generated binding: the wrappers in escape.cpp export plain C functions
// (escape.h), compiled against it with the library's own flags
const api = {
  // JSON-escape src[0..len) into dst (no surrounding quotes); returns bytes
  // written. dst needs room for 6 * len in the worst case (control bytes)
  escape_into: {
    parameters: ['pointer', 'pointer', 'u32'],
    pointers: ['char*', 'const char*'],
    result: 'u32',
    name: 'lo_simdjson_escape_into'
  }
}

const name = 'simdjson'
const includes = ['escape.h']
const obj = ['escape.o', 'deps/simdjson/simdjson.o']
const version = '5.0.5'

export { name, api, includes, obj, version }
