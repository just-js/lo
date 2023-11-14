import {
  bindings, linkerScript, headerFile, makeFile, config
} from './lib/gen.js'

let args
if (globalThis.Deno) {
  args = Deno.args
} else if (globalThis.Bun) {
  args = process.argv.slice(2)
} else if (globalThis.lo) {
  args = lo.args.slice(2)
}

let source = ''
if (args[0] === '--link') {
  let next = 1
  if (args[1] === '--win') {
    config.os = 'win'
    next = 2
  }
  source += await linkerScript('main.js')
  for (const fileName of args.slice(next)) {
    source += await linkerScript(fileName)
  }
} else if (args[0] === '--header') {
  let next = 1
  if (args[1] === '--win') {
    config.os = 'win'
    next = 2
  }
  source = await headerFile(args.slice(next))
} else if (args[0] === '--make') {
  source = await makeFile(args[1])
} else {
  source = await bindings(args[0])
}
console.log(source)
