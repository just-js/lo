import { join } from 'lib/path.js'
import { stringify } from 'lib/stringify.js'
import * as proc from 'lib/proc.js'
import { control } from 'lib/ansi.js'
import { dump } from 'lib/binary.js'

const boot_time = Math.floor((lo.hrtime() - lo.start) / 10000) / 100
const { 
  core, assert, version, handle_error, ptr, colors 
} = lo
const { 
  write, arch, os, getchar
} = core

let repl

function logo () {
  console.log(`⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛
⬛⬜⬜⬜⬜⬛⬛⬜⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬛⬛⬜⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛⬜⬜⬛⬜⬛⬜⬛
⬛⬜⬜⬛⬜⬜⬜⬛⬛⬜⬜⬜⬜⬜⬛⬛⬜⬛⬛⬜⬜⬛
⬛⬜⬛⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛
⬛⬜⬛⬜⬜⬛⬜⬜⬜⬛⬛⬜⬜⬛⬛⬜⬜⬜⬜⬜⬜⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬛
⬛⬜⬜⬜⬛⬜⬜⬛⬜⬜⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬛
⬛⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬛
⬛⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬛⬛⬜⬜⬛⬜⬜⬜⬛
⬛⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬛⬜⬜⬛⬜⬛⬜⬜⬜⬛
⬛⬜⬜⬜⬜⬜⬛⬜⬜⬜⬜⬜⬛⬜⬜⬛⬜⬛⬜⬜⬜⬛
⬛⬜⬜⬜⬜⬛⬜⬛⬜⬜⬜⬜⬜⬛⬛⬜⬛⬜⬛⬜⬜⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬛⬜⬜⬜⬜⬜⬜⬛⬜⬜⬜⬛⬜⬛
⬛⬜⬜⬜⬛⬜⬜⬜⬜⬛⬛⬜⬜⬛⬛⬜⬜⬜⬜⬛⬜⬛
⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬛
⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛
`)
}

if (os === 'win') {
  const { column, cls } = control
  const { exec, mem } = proc
  const async_fn = Object.getPrototypeOf(async function() {})
  const { AG, AD, AY, AM } = colors
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const prompt = ptr(encoder.encode(`${AG}>${AD} \0`))

  function info () {
    console.log(`  ${AG}lo${AD}    ${version.lo} ${column(26)}${AG}v8${AD}    ${version.v8}
  ${AM}arch${AD}  ${arch} ${control.column(26)}${AM}os${AD}    ${os}
  ${AY}boot${AD}  ${boot_time} ms ${column(26)}${AY}rss${AD}   ${mem()}
  `)
  }

  async function handle_command (command) {
    if (!command) return
    if (command[0] === '!') {
      const [cmd, ...args] = command.slice(1).split(' ')
      exec(cmd, args)
      return
    }
    if (command === '.cls') {
      cls(1)
      return
    }
    if (command === '.info') {
      info()
      return
    }
    const result = await async_fn.constructor(`return (${command})`)
      .call(this, command)
    if (result !== null && result !== undefined) {
      if (result === null) {
        console.log('<null>')
      } else if (result === undefined) { 
        console.log('<undefined>')
      } else if (!result.constructor) { 
        console.log(stringify(result))
      } else if (result.constructor.name === 'Number') {
        console.log(result)
      } else if (result.constructor.name === 'String') {
        console.log(`${result}`)
      } else if (ArrayBuffer.isView(result)) {
        const { buffer, byteOffset, length } = result
        console.log(dump(new Uint8Array(buffer, byteOffset, length)))
      } else {
        console.log(stringify(result))
      }
    }
  }

  repl = async function () {
    const max_len = 65536
    logo()
    info()
    const buffer = new Uint8Array(max_len)
    let n = 0
    write(1, prompt.ptr, prompt.length)
    while (true) {
      if (n === max_len) {
        console.log('line is too long')
        n = 0
        continue
      }
      const c = buffer[n++] = getchar()
      if (c === 0) break
      if (c === 10) {
        const command = decoder.decode(buffer.subarray(0, n)).trim()
        if (command === '.exit') break
        try {
          await handle_command(command)
        } catch (err) {
          handle_error(err)
        }
        n = 0
        write(1, prompt.ptr, prompt.length)
      }
    }
  }

} else {
  const { utf8_decode, wrap } = lo
  const { strnlen, isatty } = core
  const { bestlines } = lo.load('bestlines')

  const { AG, AD, AR, AY, AM } = colors

  const encoder = new TextEncoder()
  const u32 = new Uint32Array(2)

  const { bestline, bestline_raw } = bestlines
  //const bestline = wrap(u32, bestlines.bestline, 1)
  //const bestline_raw = wrap(u32, bestlines.bestline_raw, 3)
  const { cls, add, save, load } = bestlines
  const { STDIN, STDOUT, STDERR } = core

  const history_path = join(core.homedir, '.lo_history')

  load(history_path)
  const prompt = ptr(encoder.encode(`${AG}>${AD} \0`))
  const async_fn = Object.getPrototypeOf(async function() {})

  function on_unhandled_rejection (err) {
    //console.error(`${AR}Unhandled Rejection${AD}`)
    //console.error(err.stack)
  }

  globalThis.onUnhandledRejection = on_unhandled_rejection

  function info () {
    console.log(` ${AG}lo${AD}    ${lo.version.lo} ${control.column(26)}${AG}v8${AD}    ${lo.version.v8}
  ${AM}arch${AD}  ${lo.core.arch} ${control.column(26)}${AM}os${AD}    ${lo.core.os}
  ${AY}boot${AD}  ${boot_time} ms ${control.column(26)}${AY}rss${AD}   ${proc.mem()}
  `)
  }

  const MAX_LINE = 65536

  function bestline_notatty (p) {
    return bestline(p)
  }

  function bestline_isatty (p) {
    return bestline_raw(p, STDIN, STDOUT)
  }

  let nextline = (isatty(STDIN) && isatty(STDOUT)) ? bestline_isatty : bestline_notatty

  repl = async function (ctx) {
  //  cls(1)
    logo()
    info()
    let line
    globalThis.repl = ctx
    while (line = nextline(prompt.ptr)) {
      try {
        const len = strnlen(line, MAX_LINE)
        if (len === 0) continue
        const command = utf8_decode(line, len)
        if (!command) continue
        if (command === '.exit') break
        if (command === '.save') {
          save(history_path)
          continue
        }
        if (command === '.cls') {
          cls(1)
          continue
        }
        if (command === '.info') {
          info()
          add(line)
          continue
        }
        if (command[0] === '!') {
          const [cmd, ...args] = command.slice(1).split(' ')
          proc.exec(cmd, args)
          add(line)
          continue
        }
        const result = await async_fn.constructor(`return (${command})`).call(this, command)
        if (result !== null && result !== undefined) {
          if (result === null) {
            console.log('<null>')
          } else if (result === undefined) { 
            console.log('<undefined>')
          } else if (!result.constructor) { 
            console.log(stringify(result))
          } else if (result.constructor.name === 'Number') {
            console.log(result)
          } else if (result.constructor.name === 'String') {
            console.log(`${result}`)
          } else if (ArrayBuffer.isView(result)) {
            console.log(dump(new Uint8Array(result.buffer, result.byteOffset, result.byteLength)))
          } else {
            console.log(stringify(result))
          }
        }
      } catch (err) {
        handle_error(err)
      }
      add(line)
    }

    save(history_path)
  }
}

export { repl }
