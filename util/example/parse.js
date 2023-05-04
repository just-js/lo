import { readFile } from 'lib/fs.js'

const decoder = new TextDecoder()

function require (fileName) {
  const code = decoder.decode(readFile(fileName))
  const f = new Function('exports', 'module', 'require', code)
  const mod = { exports: {} }
  f.call(globalThis, mod.exports, mod, require)
  return mod.exports
}

const acorn = require('./lib/acorn.js')

const src = decoder.decode(readFile('./util/example/sniproxy.js'))

const tokens = []

acorn.parse(src, {
  ecmaVersion: 2020,
  sourceType: 'module',
  onToken: token => {
    if (token.value === 'load') {
      console.log(`${token.start}: ${tokens[tokens.length - 2].value}.${token.value}`)
      const expr = acorn.parseExpressionAt(src, token.start)
      console.log(JSON.stringify(expr))
    }
    if (token.value === 'library') {
      console.log(`${token.start}: ${tokens[tokens.length - 2].value}.${token.value}`)
      const expr = acorn.parseExpressionAt(src, token.start)
      console.log(JSON.stringify(expr))
    }
    if (token.value === 'from') {
      console.log(`${token.start}: ${token.value}`)
      const expr = acorn.parseExpressionAt(src, token.start)
      console.log(JSON.stringify(expr))
    }
    tokens.push(token)
  }
})

