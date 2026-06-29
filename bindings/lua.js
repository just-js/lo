import { Bench } from 'lib/bench.js'

const { load, assert } = lo

const { luajit } = load('luajit')

const {
  LUA_OK,
  newstate,
  openlibs,
  dostring,
  getglobal,
  pushnumber,
  pcall,
  tonumber,
  pop,
  close
} = luajit

function lua_add (a, b) {
  getglobal(state, 'add')
  pushnumber(state, a)
  pushnumber(state, b)
  assert(pcall(state, 2, 1, 0) === LUA_OK)
  const res = tonumber(state, -1)
  pop(state, 1)
  return res
}

const state = newstate()
openlibs(state)
dostring(state, `
function add(a, b)
  return a + b
end
`)

console.log(lua_add(1, 2))
console.log(lua_add(3, 4))

const bench = new Bench()
const iter = 10
const runs = 15000000

for (let i = 0; i < iter; i++) {
  bench.start('lua.add')
  for (let j = 0; j < runs; j++) assert(lua_add(1, 2) === 3)
  bench.end(runs)
}

close(state)
