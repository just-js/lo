import * as ansi from 'lib/ansi.js'
import * as bench from 'lib/bench.js'
import * as binary from 'lib/binary.js'
import * as ffi from 'lib/ffi.js'
import * as gen from 'lib/gen.js'
import * as hash from 'lib/hash.js'
import * as loop from 'lib/loop.js'
import * as net from 'lib/net.js'
import * as packet from 'lib/packet.js'
import * as path from 'lib/path.js'
import * as sni from 'lib/sni.js'
import * as socket from 'lib/socket.js'
import * as sqlite from 'lib/sqlite.js'
import * as stats from 'lib/stats.js'
import * as stringify from 'lib/stringify.js'
import * as tcc from 'lib/tcc.js'
import * as timer from 'lib/timer.js'
import * as websocket from 'lib/websocket.js'
import * as wireguard from 'lib/wireguard.js'

function loadLibraries () {
  const { epoll } = spin.load('epoll')
  const { ffi } = spin.load('ffi')
  const { fs } = spin.load('fs')
  const { libssl } = spin.load('libssl')
  const { load } = spin.load('load')
  const { net } = spin.load('net')
  const { pico } = spin.load('pico')
  const { rsync } = spin.load('rsync')
  const { seccomp } = spin.load('seccomp')
  const { sqlite } = spin.load('sqlite')
  const { system } = spin.load('system')
  const { tcc } = spin.load('tcc')
  const { wireguard } = spin.load('wireguard')
  return {
    epoll, net, system, fs, sqlite, tcc, libssl, load, spin, ffi, pico,
    rsync, seccomp, wireguard
  }
}

const libs = loadLibraries()

import { dump } from 'lib/binary.js'

export { dump, libs }
