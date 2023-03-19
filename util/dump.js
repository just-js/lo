const { epoll } = spin.load('epoll')
const { fs } = spin.load('fs')
const { libssl } = spin.load('libssl')
const { load } = spin.load('load')
const { net } = spin.load('net')
const { sqlite } = spin.load('sqlite')
const { system } = spin.load('system')
const { tcc } = spin.load('tcc')

import * as ansi from 'lib/ansi.js'
import * as bench from 'lib/bench.js'
//import * as ffi from 'lib/ffi.js'
import * as gen from 'lib/gen.js'
import * as stringify from 'lib/stringify.js'

const cache = Array.from(spin.moduleCache.entries())

console.log(stringify.stringify({
  spin,
  libs: { epoll, net, system, fs, sqlite, tcc, libssl, load, spin },
  mods: { ansi, bench, gen, stringify },
  //cache
}))
