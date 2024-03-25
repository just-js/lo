import { join } from 'lib/path.js'
import { stringify } from 'lib/stringify.js'
import * as proc from 'lib/proc.js'

const boot_time = Math.floor((lo.hrtime() - lo.start) / 10000) / 100

const { bestlines } = lo.load('bestlines')

const { colors, utf8_decode, wrap, core, module_cache, builtins, builtin } = lo

const { AG, AD, AR, AY, AM } = colors

const encoder = new TextEncoder()
const u32 = new Uint32Array(2)

const bestline = wrap(u32, bestlines.bestline, 1)
const { cls, add, save, load } = bestlines

const history_path = join(core.homedir, '.lo_history')

load(history_path)
const prompt = encoder.encode(`${AG}>${AD} \0`)
const async_fn = Object.getPrototypeOf(async function() {})

function on_unhandled_rejection (err) {
  //console.error(`${AR}Unhandled Rejection${AD}`)
  //console.error(err.stack)
}

globalThis.onUnhandledRejection = on_unhandled_rejection

function get_lines_for_error (file_name, line_num, col_num) {
  if (builtins().includes(file_name)) {
    return builtin(file_name).split('\n').slice(line_num - 5, line_num + 5).map((l, i) => `${AY}${(i + line_num - 4).toString().padStart(4, ' ')}${AD}: ${i === 4 ? AM : ''}${l}${AD}`).join('\n')
  }
  if (Array.from(module_cache.keys()).includes(file_name)) {
    return module_cache.get(file_name).split('\n').slice(line_num - 5, line_num + 5).map((l, i) => `${AY}${(i + line_num - 4).toString().padStart(4, ' ')}${AD}: ${i === 5 ? AM : ''}${l}${AD}`).join('\n')
  }
  return ''
}

const rx = /\(([\w\/\.]+):(\d+):(\d+)\)/

function handle_error (err) {
  const { stack } = err
  const stack_lines = stack.split('\n')
  const match = rx.exec(stack_lines[1])
  const file_name = match[1].trim()
  const line_num = parseInt(match[2], 10)
  const col_num = parseInt(match[3], 10)
  const lines = get_lines_for_error(file_name, line_num, col_num)
  console.error(`${AR}Error${AD} ${err.message}${AD}\n${stack.split('\n').slice(1).join('\n')}`)
  //console.error(builtin(file_name).split('\n').slice(line_num - 5, line_num + 5).join('\n'))
  console.error(lines)
}

function info () {
  console.log(`${AG}lo${AD}    ${lo.version.lo}
${AG}v8${AD}    ${lo.version.v8}
${AM}arch${AD}  ${lo.core.arch}
${AM}os${AD}    ${lo.core.os}
${AY}boot${AD}  ${boot_time} ms
${AY}rss${AD}   ${proc.mem()} MB
`)
}

async function repl () {
  cls(1)
  info()
  let line
  while (line = bestline(prompt)) {
    try {
      const command = utf8_decode(line, -1)
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
          console.log(`"${result}"`)
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

export { repl }
