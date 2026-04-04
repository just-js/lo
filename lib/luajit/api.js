const api = {
  newstate: {
    parameters: [],
    result: 'pointer',
    name: 'luaL_newstate'
  },
  openlibs: {
    parameters: ['pointer'],
    pointers: ['lua_State*'],
    result: 'void',
    name: 'luaL_openlibs'
  },
  dostring: {
    parameters: ['pointer', 'string'],
    pointers: ['lua_State*'],
    result: 'i32',
    name: 'luaL_dostring'
  },
  close: {
    parameters: ['pointer'],
    pointers: ['lua_State*'],
    result: 'void',
    name: 'lua_close'
  },
  dofile: {
    parameters: ['pointer', 'string'],
    pointers: ['lua_State*'],
    result: 'i32',
    name: 'luaL_dofile'
  },

  getglobal: {
    parameters: ['pointer', 'string'],
    pointers: ['lua_State*'],
    result: 'void',
    name: 'lua_getglobal'
  },
  pushnumber: {
    parameters: ['pointer', 'i32'],
    pointers: ['lua_State*'],
    result: 'void',
    name: 'lua_pushnumber'
  },
  pcall: {
    parameters: ['pointer', 'i32', 'i32', 'i32'],
    pointers: ['lua_State*'],
    result: 'i32',
    name: 'lua_pcall'
  },
  pop: {
    parameters: ['pointer', 'i32'],
    pointers: ['lua_State*'],
    result: 'void',
    name: 'lua_pop'
  },
  tostring: {
    parameters: ['pointer', 'i32'],
    pointers: ['lua_State*'],
    result: 'pointer',
    rpointer: 'const char*',
    name: 'lua_tostring'
  },
  tonumber: {
    parameters: ['pointer', 'i32'],
    pointers: ['lua_State*'],
    result: 'u64',
    name: 'lua_tonumber'
  },
}

const preamble = `
#ifdef __cplusplus
extern "C"
    {
#endif
#include <src/lua.h>
#include <src/lualib.h>
#include <src/lauxlib.h>
#include <src/luajit.h>
#ifdef __cplusplus
    }
#endif
`

const name = 'luajit'
//const includes = ['src/lua.h', 'src/lualib.h', 'src/lauxlib.h', 'src/luajit.h']
const includes = []

const constants = { LUA_OK: 'i32' }
const obj = ['deps/luajit/src/libluajit.a']
const include_paths = ['deps/luajit']

export { name, api, constants, preamble, obj, includes, include_paths }
